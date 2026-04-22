package handlers

import (
	"database/sql"
	"fmt"
	"log"
	"math"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/busticket/backend/database"
	"github.com/gofiber/fiber/v2"
)

var discrepanciesSchemaState struct {
	mu    sync.Mutex
	ready bool
}

func ensureDiscrepanciesSchema() error {
	discrepanciesSchemaState.mu.Lock()
	defer discrepanciesSchemaState.mu.Unlock()

	if discrepanciesSchemaState.ready {
		return nil
	}

	if _, err := database.Exec(`CREATE TABLE IF NOT EXISTS discrepancies (
		id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		route_id UUID REFERENCES routes(id) ON DELETE SET NULL,
		bus_number VARCHAR(50) NOT NULL DEFAULT '',
		transaction_date DATE NOT NULL,
		expected_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
		actual_revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
		loss_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
		status VARCHAR(20) NOT NULL DEFAULT 'pending',
		severity VARCHAR(20) NOT NULL DEFAULT 'medium',
		notes TEXT NOT NULL DEFAULT '',
		created_by UUID REFERENCES users(id) ON DELETE SET NULL,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		CONSTRAINT discrepancies_status_check CHECK (status IN ('pending', 'investigating', 'escalated', 'resolved')),
		CONSTRAINT discrepancies_severity_check CHECK (severity IN ('low', 'medium', 'high', 'critical'))
	)`); err != nil {
		return err
	}

	if _, err := database.Exec(`ALTER TABLE discrepancies ADD COLUMN IF NOT EXISTS severity VARCHAR(20) NOT NULL DEFAULT 'medium'`); err != nil {
		return err
	}
	if _, err := database.Exec(`ALTER TABLE discrepancies ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL`); err != nil {
		return err
	}
	if _, err := database.Exec(`ALTER TABLE discrepancies ADD COLUMN IF NOT EXISTS expected_daily_revenue NUMERIC(12,2) NOT NULL DEFAULT 0`); err != nil {
		return err
	}
	if _, err := database.Exec(`ALTER TABLE discrepancies ADD COLUMN IF NOT EXISTS expected_weekly_revenue NUMERIC(12,2) NOT NULL DEFAULT 0`); err != nil {
		return err
	}
	if _, err := database.Exec(`ALTER TABLE discrepancies ADD COLUMN IF NOT EXISTS expected_monthly_revenue NUMERIC(12,2) NOT NULL DEFAULT 0`); err != nil {
		return err
	}
	if _, err := database.Exec(`ALTER TABLE discrepancies ADD COLUMN IF NOT EXISTS actual_weekly_revenue NUMERIC(12,2) NOT NULL DEFAULT 0`); err != nil {
		return err
	}
	if _, err := database.Exec(`ALTER TABLE discrepancies ADD COLUMN IF NOT EXISTS actual_monthly_revenue NUMERIC(12,2) NOT NULL DEFAULT 0`); err != nil {
		return err
	}
	if _, err := database.Exec(`ALTER TABLE discrepancies ADD COLUMN IF NOT EXISTS anomaly_score NUMERIC(12,4) NOT NULL DEFAULT 0`); err != nil {
		return err
	}
	if _, err := database.Exec(`ALTER TABLE discrepancies ADD COLUMN IF NOT EXISTS detection_method VARCHAR(100) NOT NULL DEFAULT 'timeseries_residual_v1'`); err != nil {
		return err
	}
	if _, err := database.Exec(`ALTER TABLE discrepancies ADD COLUMN IF NOT EXISTS detection_run_at TIMESTAMP`); err != nil {
		return err
	}
	if _, err := database.Exec(`ALTER TABLE discrepancies ADD COLUMN IF NOT EXISTS is_system_generated BOOLEAN NOT NULL DEFAULT true`); err != nil {
		return err
	}

	_, _ = database.Exec(`CREATE INDEX IF NOT EXISTS idx_discrepancies_route_id ON discrepancies(route_id)`)
	_, _ = database.Exec(`CREATE INDEX IF NOT EXISTS idx_discrepancies_bus_number ON discrepancies(bus_number)`)
	_, _ = database.Exec(`CREATE INDEX IF NOT EXISTS idx_discrepancies_transaction_date ON discrepancies(transaction_date)`)
	_, _ = database.Exec(`CREATE INDEX IF NOT EXISTS idx_discrepancies_status ON discrepancies(status)`)
	_, _ = database.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS uq_discrepancies_bus_date ON discrepancies(bus_number, transaction_date)`)

	discrepanciesSchemaState.ready = true

	return nil
}

type revenuePoint struct {
	busNumber string
	routeID   sql.NullString
	date      time.Time
	revenue   float64
}

type analysisSummary struct {
	AnalyzedBuses int `json:"analyzedBuses"`
	AnalyzedDays  int `json:"analyzedDays"`
	Created       int `json:"created"`
	Updated       int `json:"updated"`
	Flagged       int `json:"flagged"`
	Skipped       int `json:"skipped"`
}

func weekStartMonday(t time.Time) time.Time {
	wd := int(t.Weekday())
	if wd == 0 {
		wd = 7
	}
	dayStart := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
	return dayStart.AddDate(0, 0, -(wd - 1))
}

func monthStart(t time.Time) time.Time {
	return time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC)
}

func mean(values []float64) float64 {
	if len(values) == 0 {
		return 0
	}
	sum := 0.0
	for _, v := range values {
		sum += v
	}
	return sum / float64(len(values))
}

func stddev(values []float64, avg float64) float64 {
	if len(values) < 2 {
		return 0
	}
	var sum float64
	for _, v := range values {
		d := v - avg
		sum += d * d
	}
	variance := sum / float64(len(values)-1)
	if variance <= 0 {
		return 0
	}
	return math.Sqrt(variance)
}

func severityFromLoss(dropPct float64, lossAmount float64) string {
	switch {
	case dropPct >= 40 || lossAmount >= 10000:
		return "critical"
	case dropPct >= 30 || lossAmount >= 7000:
		return "high"
	case dropPct >= 20 || lossAmount >= 3000:
		return "medium"
	default:
		return "low"
	}
}

func upsertSystemDiscrepancy(routeID sql.NullString, busNumber string, serviceDate time.Time, expectedDaily float64, expectedWeekly float64, expectedMonthly float64, actualDaily float64, actualWeekly float64, actualMonthly float64, lossAmount float64, anomalyScore float64, severity string, notes string) (bool, bool, error) {
	// Insert-only behavior: create a discrepancy row if one doesn't already exist
	// for the same bus_number and transaction_date. Do not update existing rows.
	res, err := database.Exec(
		`INSERT INTO discrepancies (
			route_id,
			bus_number,
			transaction_date,
			expected_revenue,
			actual_revenue,
			loss_amount,
			status,
			severity,
			notes,
			expected_daily_revenue,
			expected_weekly_revenue,
			expected_monthly_revenue,
			actual_weekly_revenue,
			actual_monthly_revenue,
			anomaly_score,
			detection_method,
			detection_run_at,
			is_system_generated
		) VALUES (
			$1,
			$2,
			$3::date,
			$4,
			$5,
			$6,
			'pending',
			$7,
			$8,
			$9,
			$10,
			$11,
			$12,
			$13,
			$14,
			'timeseries_residual_v1',
			NOW(),
			true
		)
		ON CONFLICT (bus_number, transaction_date) DO NOTHING`,
		routeID,
		busNumber,
		serviceDate.Format("2006-01-02"),
		expectedDaily,
		actualDaily,
		lossAmount,
		severity,
		notes,
		expectedDaily,
		expectedWeekly,
		expectedMonthly,
		actualWeekly,
		actualMonthly,
		anomalyScore,
	)
	if err != nil {
		return false, false, err
	}
	ra, _ := res.RowsAffected()
	inserted := ra > 0
	return inserted, false, nil
}

func runDiscrepancyAnalysis(days int) (analysisSummary, error) {
	summary := analysisSummary{}

	lookbackDays := days + 120
	startDate := time.Now().AddDate(0, 0, -lookbackDays).Format("2006-01-02")
	analysisStart := time.Date(time.Now().Year(), time.Now().Month(), time.Now().Day(), 0, 0, 0, 0, time.UTC).AddDate(0, 0, -(days - 1))

	rows, err := database.Query(
		`WITH route_revenue AS (
			SELECT
				COALESCE(t.bus_number, '') AS bus_number,
				tr.transaction_date::date AS service_date,
				t.route_id,
				SUM(tr.amount) AS revenue
			FROM transactions tr
			LEFT JOIN tickets t ON t.ticket_number = tr.ticket_id
			WHERE LOWER(COALESCE(tr.status, '')) = 'completed'
				AND COALESCE(t.bus_number, '') <> ''
				AND tr.transaction_date::date >= $1::date
			GROUP BY COALESCE(t.bus_number, ''), tr.transaction_date::date, t.route_id
		),
		bus_day AS (
			SELECT bus_number, service_date, SUM(revenue) AS total_revenue
			FROM route_revenue
			GROUP BY bus_number, service_date
		),
		dominant AS (
			SELECT bus_number, service_date, route_id,
			ROW_NUMBER() OVER (
				PARTITION BY bus_number, service_date
				ORDER BY revenue DESC
			) AS rn
			FROM route_revenue
		)
		SELECT b.bus_number, b.service_date, d.route_id, b.total_revenue
		FROM bus_day b
		LEFT JOIN dominant d ON d.bus_number = b.bus_number AND d.service_date = b.service_date AND d.rn = 1
		ORDER BY b.bus_number ASC, b.service_date ASC`,
		startDate,
	)
	if err != nil {
		return summary, err
	}
	defer rows.Close()

	byBus := map[string][]revenuePoint{}
	for rows.Next() {
		var p revenuePoint
		if scanErr := rows.Scan(&p.busNumber, &p.date, &p.routeID, &p.revenue); scanErr != nil {
			continue
		}
		p.date = time.Date(p.date.Year(), p.date.Month(), p.date.Day(), 0, 0, 0, 0, time.UTC)
		byBus[p.busNumber] = append(byBus[p.busNumber], p)
	}

	summary.AnalyzedBuses = len(byBus)

	for busNumber, points := range byBus {
		sort.Slice(points, func(i, j int) bool {
			return points[i].date.Before(points[j].date)
		})

		weeklyTotals := map[string]float64{}
		monthlyTotals := map[string]float64{}
		for _, p := range points {
			wk := weekStartMonday(p.date).Format("2006-01-02")
			mo := monthStart(p.date).Format("2006-01-02")
			weeklyTotals[wk] += p.revenue
			monthlyTotals[mo] += p.revenue
		}

		for idx, p := range points {
			if p.date.Before(analysisStart) {
				continue
			}
			summary.AnalyzedDays++

			sameWeekday := []float64{}
			for i := idx - 1; i >= 0; i-- {
				if points[i].date.Weekday() == p.date.Weekday() {
					sameWeekday = append(sameWeekday, points[i].revenue)
					if len(sameWeekday) >= 8 {
						break
					}
				}
			}

			if len(sameWeekday) < 4 {
				summary.Skipped++
				continue
			}

			expectedDaily := mean(sameWeekday)
			if expectedDaily <= 0 {
				summary.Skipped++
				continue
			}

			dailyStd := stddev(sameWeekday, expectedDaily)
			actualDaily := p.revenue
			loss := expectedDaily - actualDaily
			if loss <= 0 {
				summary.Skipped++
				continue
			}

			dropPct := (loss / expectedDaily) * 100
			zScore := 0.0
			if dailyStd > 0 {
				zScore = (actualDaily - expectedDaily) / dailyStd
			}

			weekStart := weekStartMonday(p.date)
			actualWeekly := weeklyTotals[weekStart.Format("2006-01-02")]
			priorWeekly := []float64{}
			for i := 1; i <= 4; i++ {
				k := weekStart.AddDate(0, 0, -7*i).Format("2006-01-02")
				if v, ok := weeklyTotals[k]; ok {
					priorWeekly = append(priorWeekly, v)
				}
			}
			expectedWeekly := mean(priorWeekly)

			monthKey := monthStart(p.date)
			actualMonthly := monthlyTotals[monthKey.Format("2006-01-02")]
			priorMonthly := []float64{}
			for i := 1; i <= 3; i++ {
				k := monthStart(monthKey.AddDate(0, -i, 0)).Format("2006-01-02")
				if v, ok := monthlyTotals[k]; ok {
					priorMonthly = append(priorMonthly, v)
				}
			}
			expectedMonthly := mean(priorMonthly)

			weeklyWeak := expectedWeekly <= 0 || actualWeekly <= expectedWeekly*0.85
			monthlyWeak := expectedMonthly <= 0 || actualMonthly <= expectedMonthly*0.90
			isAnomaly := (dropPct >= 20 && loss >= 2000 && weeklyWeak && monthlyWeak) || (zScore <= -2.5 && loss >= 2000)
			if !isAnomaly {
				summary.Skipped++
				continue
			}

			severity := severityFromLoss(dropPct, loss)
			anomalyScore := math.Abs(zScore)
			if anomalyScore == 0 {
				anomalyScore = dropPct / 10
			}

			notes := fmt.Sprintf("System-detected anomaly (time-series residual model): expected daily %.2f vs actual %.2f (drop %.1f%%).", expectedDaily, actualDaily, dropPct)
			inserted, updated, upsertErr := upsertSystemDiscrepancy(p.routeID, busNumber, p.date, expectedDaily, expectedWeekly, expectedMonthly, actualDaily, actualWeekly, actualMonthly, loss, anomalyScore, severity, notes)
			if upsertErr != nil {
				continue
			}
			summary.Flagged++
			if inserted {
				summary.Created++
			}
			if updated {
				summary.Updated++
			}
		}
	}

	return summary, nil
}

// AnalyzeDiscrepancies runs anomaly detection and updates system-generated discrepancy rows.
func AnalyzeDiscrepancies(c *fiber.Ctx) error {
	if err := enforceModulePermission(c, "discrepancies", "view"); err != nil {
		return err
	}

	if err := ensureDiscrepanciesSchema(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to prepare discrepancies schema"})
	}

	days := c.QueryInt("days", 30)
	if days < 1 {
		days = 30
	}
	if days > 365 {
		days = 365
	}

	summary, err := runDiscrepancyAnalysis(days)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to run discrepancy analysis"})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"model":   "timeseries_residual_v1",
		"window":  days,
		"summary": summary,
	})
}

// RunDiscrepancyAnalysisNow runs the discrepancy analysis logic outside of an HTTP request.
// It returns an error if the analysis failed.
func RunDiscrepancyAnalysisNow(days int) error {
	_, err := runDiscrepancyAnalysis(days)
	return err
}

// RunDiscrepancyForBusDate runs the anomaly check for a single bus and service date.
// routeID may be empty. serviceDate must be YYYY-MM-DD.
func RunDiscrepancyForBusDate(routeID string, busNumber string, serviceDate string) error {
	log.Printf("[ANALYSIS] Starting per-departure analysis: bus=%s, date=%s, route=%s", busNumber, serviceDate, routeID)

	if strings.TrimSpace(busNumber) == "" {
		return fmt.Errorf("bus number required")
	}
	sd, err := time.Parse("2006-01-02", serviceDate)
	if err != nil {
		return fmt.Errorf("invalid service date")
	}

	// Look back up to 365 days for history
	startDate := sd.AddDate(0, 0, -365).Format("2006-01-02")
	endDate := sd.Format("2006-01-02")

	log.Printf("[ANALYSIS] Querying transaction history from %s to %s", startDate, endDate)
	rows, qErr := database.Query(
		`SELECT tr.transaction_date::date AS d, COALESCE(SUM(tr.amount),0) AS revenue
		 FROM transactions tr
		 LEFT JOIN tickets t ON t.ticket_number = tr.ticket_id
		 WHERE LOWER(COALESCE(tr.status,'')) = 'completed'
		   AND COALESCE(t.bus_number,'') = $1
		   AND tr.transaction_date::date >= $2::date
		   AND tr.transaction_date::date <= $3::date
		 GROUP BY tr.transaction_date::date
		 ORDER BY tr.transaction_date::date ASC`,
		busNumber, startDate, endDate,
	)
	if qErr != nil {
		log.Printf("[ANALYSIS] ❌ Query failed: %v", qErr)
		return qErr
	}
	defer rows.Close()

	revByDate := map[string]float64{}
	var d time.Time
	var rev float64
	for rows.Next() {
		if err := rows.Scan(&d, &rev); err != nil {
			continue
		}
		revByDate[d.Format("2006-01-02")] = rev
	}

	log.Printf("[ANALYSIS] Found %d days of transaction data", len(revByDate))
	actualDaily := revByDate[sd.Format("2006-01-02")]
	log.Printf("[ANALYSIS] Actual revenue for %s: %.2f", serviceDate, actualDaily)

	// collect same-weekday historical revenues prior to service date
	sameWeekday := []float64{}
	for dtStr, v := range revByDate {
		dt, p := time.Parse("2006-01-02", dtStr)
		if p != nil {
			continue
		}
		if !dt.Before(sd) {
			continue
		}
		if dt.Weekday() == sd.Weekday() {
			sameWeekday = append(sameWeekday, v)
		}
	}

	// sort by date descending to pick recent values
	sort.Slice(sameWeekday, func(i, j int) bool { return true })
	// We only need up to 8 previous same-weekday values; ensure we have oldest->newest order is not necessary for mean
	if len(sameWeekday) < 4 {
		log.Printf("[ANALYSIS] ℹ️  Skipped: insufficient same-weekday history (%d < 4)", len(sameWeekday))
		return nil
	}

	expectedDaily := mean(sameWeekday)
	if expectedDaily <= 0 {
		log.Printf("[ANALYSIS] ℹ️  Skipped: expected daily revenue is zero or negative")
		return nil
	}

	dailyStd := stddev(sameWeekday, expectedDaily)
	loss := expectedDaily - actualDaily
	if loss <= 0 {
		log.Printf("[ANALYSIS] ℹ️  Skipped: no revenue loss detected (loss=%.2f)", loss)
		return nil
	}
	dropPct := (loss / expectedDaily) * 100
	zScore := 0.0
	if dailyStd > 0 {
		zScore = (actualDaily - expectedDaily) / dailyStd
	}

	log.Printf("[ANALYSIS] Daily check: expected=%.2f, actual=%.2f, loss=%.2f (%.1f%%), zscore=%.2f",
		expectedDaily, actualDaily, loss, dropPct, zScore)

	// weekly and monthly totals
	weeklyTotals := map[string]float64{}
	monthlyTotals := map[string]float64{}
	for dtStr, v := range revByDate {
		dt, p := time.Parse("2006-01-02", dtStr)
		if p != nil {
			continue
		}
		wk := weekStartMonday(dt).Format("2006-01-02")
		monthlyKey := monthStart(dt).Format("2006-01-02")
		weeklyTotals[wk] += v
		monthlyTotals[monthlyKey] += v
	}

	weekStart := weekStartMonday(sd).Format("2006-01-02")
	actualWeekly := weeklyTotals[weekStart]
	priorWeekly := []float64{}
	for i := 1; i <= 4; i++ {
		k := weekStartMonday(sd).AddDate(0, 0, -7*i).Format("2006-01-02")
		if v, ok := weeklyTotals[k]; ok {
			priorWeekly = append(priorWeekly, v)
		}
	}
	expectedWeekly := mean(priorWeekly)

	monthKey := monthStart(sd).Format("2006-01-02")
	actualMonthly := monthlyTotals[monthKey]
	priorMonthly := []float64{}
	for i := 1; i <= 3; i++ {
		k := monthStart(sd).AddDate(0, -i, 0).Format("2006-01-02")
		if v, ok := monthlyTotals[k]; ok {
			priorMonthly = append(priorMonthly, v)
		}
	}
	expectedMonthly := mean(priorMonthly)

	weeklyWeak := expectedWeekly <= 0 || actualWeekly <= expectedWeekly*0.85
	monthlyWeak := expectedMonthly <= 0 || actualMonthly <= expectedMonthly*0.90
	isAnomaly := (dropPct >= 20 && loss >= 2000 && weeklyWeak && monthlyWeak) || (zScore <= -2.5 && loss >= 2000)

	log.Printf("[ANALYSIS] Weekly check: expected=%.2f, actual=%.2f, weak=%v", expectedWeekly, actualWeekly, weeklyWeak)
	log.Printf("[ANALYSIS] Monthly check: expected=%.2f, actual=%.2f, weak=%v", expectedMonthly, actualMonthly, monthlyWeak)

	if !isAnomaly {
		log.Printf("[ANALYSIS] ℹ️  Skipped: not flagged as anomaly (conditions not met)")
		return nil
	}

	log.Printf("[ANALYSIS] 🚨 ANOMALY DETECTED: severity will be determined from loss amount")

	severity := severityFromLoss(dropPct, loss)
	anomalyScore := math.Abs(zScore)
	if anomalyScore == 0 {
		anomalyScore = dropPct / 10
	}

	notes := fmt.Sprintf("System-detected anomaly (time-series residual model): expected daily %.2f vs actual %.2f (drop %.1f%%).", expectedDaily, actualDaily, dropPct)
	routeNull := sql.NullString{}
	if strings.TrimSpace(routeID) != "" {
		routeNull = sql.NullString{String: routeID, Valid: true}
	}

	log.Printf("[ANALYSIS] Upserting discrepancy: severity=%s, anomaly_score=%.4f, loss=%.2f", severity, anomalyScore, loss)
	_, _, upErr := upsertSystemDiscrepancy(routeNull, busNumber, sd, expectedDaily, expectedWeekly, expectedMonthly, actualDaily, actualWeekly, actualMonthly, loss, anomalyScore, severity, notes)
	if upErr != nil {
		log.Printf("[ANALYSIS] ❌ Upsert failed: %v", upErr)
		return upErr
	}
	log.Printf("[ANALYSIS] ✅ Discrepancy upserted successfully")
	return nil
}

func normalizeDiscrepancyStatus(value string) string {
	status := strings.ToLower(strings.TrimSpace(value))
	switch status {
	case "pending", "investigating", "escalated", "resolved":
		return status
	default:
		return ""
	}
}

func normalizeDiscrepancySeverity(value string) string {
	severity := strings.ToLower(strings.TrimSpace(value))
	switch severity {
	case "low", "medium", "high", "critical":
		return severity
	default:
		return ""
	}
}

func resolveRouteID(routeID string, routeNumber string) (string, error) {
	id := strings.TrimSpace(routeID)
	routeNo := strings.TrimSpace(routeNumber)

	if id != "" {
		var existing string
		if err := database.QueryRow(`SELECT id FROM routes WHERE id = $1`, id).Scan(&existing); err != nil {
			if err == sql.ErrNoRows {
				return "", fiber.NewError(fiber.StatusBadRequest, "Invalid route_id")
			}
			return "", err
		}
		return existing, nil
	}

	if routeNo != "" {
		var existing string
		if err := database.QueryRow(`SELECT id FROM routes WHERE route_number = $1 ORDER BY created_at DESC LIMIT 1`, routeNo).Scan(&existing); err != nil {
			if err == sql.ErrNoRows {
				return "", fiber.NewError(fiber.StatusBadRequest, "Invalid route_number")
			}
			return "", err
		}
		return existing, nil
	}

	return "", fiber.NewError(fiber.StatusBadRequest, "route_id or route_number is required")
}

// Manual creation of discrepancies via API was removed to keep discrepancies system-generated only.

// GetDiscrepancies retrieves discrepancies with optional filters
func GetDiscrepancies(c *fiber.Ctx) error {
	if err := enforceModulePermission(c, "discrepancies", "view"); err != nil {
		return err
	}

	if err := ensureDiscrepanciesSchema(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to prepare discrepancies schema"})
	}

	page := c.QueryInt("page", 1)
	limit := c.QueryInt("limit", 10)
	status := normalizeDiscrepancyStatus(c.Query("status"))
	severity := normalizeDiscrepancySeverity(c.Query("severity"))
	routeNumber := strings.TrimSpace(c.Query("routeNumber"))
	busNumber := strings.TrimSpace(c.Query("busNumber"))
	dateFrom := strings.TrimSpace(c.Query("dateFrom"))
	dateTo := strings.TrimSpace(c.Query("dateTo"))

	role := normalizeRole(fmt.Sprint(c.Locals("userRole")))
	actorUserID := strings.TrimSpace(fmt.Sprint(c.Locals("userId")))

	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 10
	}
	if limit > 200 {
		limit = 200
	}
	offset := (page - 1) * limit

	filters := []string{"1=1"}
	args := []interface{}{}
	argPos := 1

	if status != "" {
		filters = append(filters, "LOWER(d.status) = LOWER($"+itoa(argPos)+")")
		args = append(args, status)
		argPos++
	}
	if severity != "" {
		filters = append(filters, "LOWER(d.severity) = LOWER($"+itoa(argPos)+")")
		args = append(args, severity)
		argPos++
	}
	if routeNumber != "" {
		filters = append(filters, "LOWER(COALESCE(r.route_number, '')) = LOWER($"+itoa(argPos)+")")
		args = append(args, routeNumber)
		argPos++
	}
	if busNumber != "" {
		filters = append(filters, "LOWER(COALESCE(d.bus_number, '')) = LOWER($"+itoa(argPos)+")")
		args = append(args, busNumber)
		argPos++
	}
	if dateFrom != "" {
		filters = append(filters, "d.transaction_date >= $"+itoa(argPos)+"::date")
		args = append(args, dateFrom)
		argPos++
	}
	if dateTo != "" {
		filters = append(filters, "d.transaction_date <= $"+itoa(argPos)+"::date")
		args = append(args, dateTo)
		argPos++
	}
	if role == "bus_owner" && actorUserID != "" && actorUserID != "<nil>" {
		filters = append(filters, `d.bus_number IN (
			SELECT b.bus_number FROM buses b
			WHERE b.owner_user_id = $`+itoa(argPos)+` OR b.created_by = $`+itoa(argPos)+`
		)`)
		args = append(args, actorUserID)
		argPos++
	}

	whereClause := strings.Join(filters, " AND ")

	countQuery := `SELECT COUNT(*) FROM discrepancies d LEFT JOIN routes r ON r.id = d.route_id WHERE ` + whereClause
	var total int
	if err := database.QueryRow(countQuery, args...).Scan(&total); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to count discrepancies"})
	}

	query := `SELECT d.id,
	                 COALESCE(r.route_number, ''),
	                 COALESCE(d.bus_number, ''),
	                 d.transaction_date,
	                 COALESCE(d.expected_revenue, 0),
	                 COALESCE(d.expected_daily_revenue, 0),
	                 COALESCE(d.expected_weekly_revenue, 0),
	                 COALESCE(d.expected_monthly_revenue, 0),
	                 COALESCE(d.actual_revenue, 0),
	                 COALESCE(d.actual_weekly_revenue, 0),
	                 COALESCE(d.actual_monthly_revenue, 0),
	                 COALESCE(d.loss_amount, 0),
	                 COALESCE(d.anomaly_score, 0),
	                 COALESCE(d.status, ''),
	                 COALESCE(d.severity, ''),
	                 COALESCE(d.notes, ''),
	                 COALESCE(d.detection_method, ''),
	                 d.detection_run_at,
	                 d.created_at,
	                 d.updated_at
	          FROM discrepancies d
	          LEFT JOIN routes r ON r.id = d.route_id
	          WHERE ` + whereClause + `
	          ORDER BY d.created_at DESC
	          LIMIT $` + itoa(argPos) + ` OFFSET $` + itoa(argPos+1)

	dataArgs := append([]interface{}{}, args...)
	dataArgs = append(dataArgs, limit, offset)
	rows, err := database.Query(query, dataArgs...)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load discrepancies"})
	}
	defer rows.Close()

	items := []fiber.Map{}
	for rows.Next() {
		var id string
		var routeNo string
		var busNo string
		var txDate sql.NullTime
		var expected float64
		var expectedDaily float64
		var expectedWeekly float64
		var expectedMonthly float64
		var actual float64
		var actualWeekly float64
		var actualMonthly float64
		var loss float64
		var anomalyScore float64
		var itemStatus string
		var itemSeverity string
		var notes string
		var detectionMethod string
		var detectionRunAt sql.NullTime
		var createdAt time.Time
		var updatedAt time.Time

		if scanErr := rows.Scan(
			&id,
			&routeNo,
			&busNo,
			&txDate,
			&expected,
			&expectedDaily,
			&expectedWeekly,
			&expectedMonthly,
			&actual,
			&actualWeekly,
			&actualMonthly,
			&loss,
			&anomalyScore,
			&itemStatus,
			&itemSeverity,
			&notes,
			&detectionMethod,
			&detectionRunAt,
			&createdAt,
			&updatedAt,
		); scanErr != nil {
			continue
		}

		var txDateValue interface{} = nil
		if txDate.Valid {
			txDateValue = txDate.Time
		}

		items = append(items, fiber.Map{
			"id":               id,
			"route_number":     routeNo,
			"bus_number":       busNo,
			"transaction_date": txDateValue,
			"expected_revenue": expected,
			"expected_daily":   expectedDaily,
			"expected_weekly":  expectedWeekly,
			"expected_monthly": expectedMonthly,
			"actual_revenue":   actual,
			"actual_weekly":    actualWeekly,
			"actual_monthly":   actualMonthly,
			"loss_amount":      loss,
			"anomaly_score":    anomalyScore,
			"status":           itemStatus,
			"severity":         itemSeverity,
			"notes":            notes,
			"detection_method": detectionMethod,
			"detection_run_at": detectionRunAt.Time,
			"created_at":       createdAt,
			"updated_at":       updatedAt,
		})
	}

	return c.JSON(fiber.Map{
		"discrepancies": items,
		"pagination": fiber.Map{
			"page":  page,
			"limit": limit,
			"total": total,
		},
	})
}

// GetDiscrepancy retrieves a specific discrepancy
func GetDiscrepancy(c *fiber.Ctx) error {
	if err := enforceModulePermission(c, "discrepancies", "view"); err != nil {
		return err
	}

	if err := ensureDiscrepanciesSchema(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to prepare discrepancies schema"})
	}

	id := strings.TrimSpace(c.Params("id"))
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id is required"})
	}

	var routeNo string
	var busNo string
	var txDate sql.NullTime
	var expected float64
	var actual float64
	var loss float64
	var itemStatus string
	var itemSeverity string
	var notes string
	var createdAt time.Time
	var updatedAt time.Time

	err := database.QueryRow(`SELECT COALESCE(r.route_number, ''), COALESCE(d.bus_number, ''), d.transaction_date,
			COALESCE(d.expected_revenue, 0), COALESCE(d.actual_revenue, 0), COALESCE(d.loss_amount, 0),
			COALESCE(d.status, ''), COALESCE(d.severity, ''), COALESCE(d.notes, ''), d.created_at, d.updated_at
		FROM discrepancies d
		LEFT JOIN routes r ON r.id = d.route_id
		WHERE d.id = $1`, id).Scan(&routeNo, &busNo, &txDate, &expected, &actual, &loss, &itemStatus, &itemSeverity, &notes, &createdAt, &updatedAt)
	if err == sql.ErrNoRows {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Discrepancy not found"})
	}
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to load discrepancy"})
	}

	return c.JSON(fiber.Map{
		"discrepancy": fiber.Map{
			"id":               id,
			"route_number":     routeNo,
			"bus_number":       busNo,
			"transaction_date": txDate.Time,
			"expected_revenue": expected,
			"actual_revenue":   actual,
			"loss_amount":      loss,
			"status":           itemStatus,
			"severity":         itemSeverity,
			"notes":            notes,
			"created_at":       createdAt,
			"updated_at":       updatedAt,
		},
	})
}

// UpdateDiscrepancyStatus updates the status of a discrepancy
func UpdateDiscrepancyStatus(c *fiber.Ctx) error {
	if err := enforceModulePermission(c, "discrepancies", "edit"); err != nil {
		return err
	}

	if err := ensureDiscrepanciesSchema(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to prepare discrepancies schema"})
	}

	id := strings.TrimSpace(c.Params("id"))
	if id == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "id is required"})
	}

	type UpdateStatusRequest struct {
		Status string `json:"status" validate:"required,oneof=pending investigating escalated resolved"`
		Notes  string `json:"notes"`
	}

	var req UpdateStatusRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	status := normalizeDiscrepancyStatus(req.Status)
	if status == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid status"})
	}

	notes := strings.TrimSpace(req.Notes)

	res, err := database.Exec(
		`UPDATE discrepancies SET status = $1, notes = $2, updated_at = NOW() WHERE id = $3`,
		status,
		notes,
		id,
	)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update discrepancy"})
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Discrepancy not found"})
	}

	return c.JSON(fiber.Map{
		"success":     true,
		"discrepancy": fiber.Map{"id": id, "status": status, "notes": notes},
	})
}

// GetDiscrepancyStats retrieves discrepancy statistics
func GetDiscrepancyStats(c *fiber.Ctx) error {
	if err := enforceModulePermission(c, "discrepancies", "view"); err != nil {
		return err
	}

	if err := ensureDiscrepanciesSchema(); err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to prepare discrepancies schema"})
	}

	role := normalizeRole(fmt.Sprint(c.Locals("userRole")))
	actorUserID := strings.TrimSpace(fmt.Sprint(c.Locals("userId")))

	// For bus owners, limit stats to discrepancies affecting their registered buses.
	whereClause := ""
	var whereArgs []interface{}
	if role == "bus_owner" && actorUserID != "" && actorUserID != "<nil>" {
		whereClause = ` WHERE d.bus_number IN (
			SELECT b.bus_number FROM buses b WHERE b.owner_user_id = $1 OR b.created_by = $1
		)`
		whereArgs = append(whereArgs, actorUserID)
	}

	var total int
	_ = database.QueryRow(`SELECT COUNT(*) FROM discrepancies d`+whereClause, whereArgs...).Scan(&total)

	byStatus := fiber.Map{}
	statusRows, _ := database.Query(`SELECT COALESCE(status, ''), COUNT(*) FROM discrepancies d`+whereClause+` GROUP BY COALESCE(status, '')`, whereArgs...)
	if statusRows != nil {
		defer statusRows.Close()
		for statusRows.Next() {
			var status string
			var count int
			if err := statusRows.Scan(&status, &count); err == nil {
				byStatus[status] = count
			}
		}
	}

	byRoute := fiber.Map{}
	routeRows, _ := database.Query(`SELECT COALESCE(r.route_number, ''), COUNT(*) FROM discrepancies d LEFT JOIN routes r ON r.id = d.route_id `+whereClause+` GROUP BY COALESCE(r.route_number, '')`, whereArgs...)
	if routeRows != nil {
		defer routeRows.Close()
		for routeRows.Next() {
			var route string
			var count int
			if err := routeRows.Scan(&route, &count); err == nil {
				byRoute[route] = count
			}
		}
	}

	bySeverity := fiber.Map{}
	severityRows, _ := database.Query(`SELECT COALESCE(severity, ''), COUNT(*) FROM discrepancies d`+whereClause+` GROUP BY COALESCE(severity, '')`, whereArgs...)
	if severityRows != nil {
		defer severityRows.Close()
		for severityRows.Next() {
			var severity string
			var count int
			if err := severityRows.Scan(&severity, &count); err == nil {
				bySeverity[severity] = count
			}
		}
	}

	var totalLoss float64
	_ = database.QueryRow(`SELECT COALESCE(SUM(loss_amount), 0) FROM discrepancies d`+whereClause, whereArgs...).Scan(&totalLoss)

	return c.JSON(fiber.Map{
		"totalDiscrepancies": total,
		"byStatus":           byStatus,
		"bySeverity":         bySeverity,
		"byRoute":            byRoute,
		"totalLoss":          totalLoss,
	})
}
