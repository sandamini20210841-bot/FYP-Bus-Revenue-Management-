package handlers

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/busticket/backend/database"
	"github.com/gofiber/fiber/v2"
)

// ExportTransactionsCSV streams all transactions in a date range as CSV
func ExportTransactionsCSV(c *fiber.Ctx) error {
	type ExportRequest struct {
		DateFrom string `json:"date_from"`
		DateTo   string `json:"date_to"`
		Route    string `json:"route"`
		Bus      string `json:"bus"`
		Status   string `json:"status"`
	}

	var req ExportRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Build query
	whereParts := []string{}
	args := []interface{}{}
	argPos := 1
	if req.DateFrom != "" {
		whereParts = append(whereParts, "tr.transaction_date >= $"+strconv.Itoa(argPos)+"::date")
		args = append(args, req.DateFrom)
		argPos++
	}
	if req.DateTo != "" {
		whereParts = append(whereParts, "tr.transaction_date < ($"+strconv.Itoa(argPos)+"::date + INTERVAL '1 day')")
		args = append(args, req.DateTo)
		argPos++
	}
	if req.Route != "" {
		whereParts = append(whereParts, "r.route_number = $"+strconv.Itoa(argPos))
		args = append(args, req.Route)
		argPos++
	}
	if req.Bus != "" {
		whereParts = append(whereParts, "t.bus_number = $"+strconv.Itoa(argPos))
		args = append(args, req.Bus)
		argPos++
	}
	if req.Status != "" {
		whereParts = append(whereParts, "LOWER(tr.status) = LOWER($"+strconv.Itoa(argPos)+")")
		args = append(args, req.Status)
		argPos++
	}

	baseFrom := `
		FROM transactions tr
		LEFT JOIN tickets t ON t.ticket_number = tr.ticket_id
		LEFT JOIN routes r ON r.id = t.route_id
		LEFT JOIN stops fs ON fs.id = t.from_stop_id
		LEFT JOIN stops ts ON ts.id = t.to_stop_id
	`
	whereClause := ""
	if len(whereParts) > 0 {
		whereClause = " WHERE " + strings.Join(whereParts, " AND ")
	}

	dataQuery := `
		SELECT
			tr.id,
			COALESCE(r.route_number, ''),
			COALESCE(t.bus_number, ''),
			COALESCE(tr.ticket_id, ''),
			tr.transaction_date,
			tr.amount,
			COALESCE(fs.stop_name, ''),
			COALESCE(ts.stop_name, ''),
			COALESCE(tr.status, '')
		` + baseFrom + whereClause + `
		ORDER BY tr.transaction_date DESC`

	rows, err := database.Query(dataQuery, args...)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to query transactions"})
	}
	defer rows.Close()

	// Set CSV headers
	c.Set("Content-Type", "text/csv")
	c.Set("Content-Disposition", "attachment; filename=transactions_export.csv")

	// Use csv.Writer to stream to response
	w := csv.NewWriter(c.Context().Response.BodyWriter())
	defer w.Flush()

	header := []string{"ID", "Route", "Bus Number", "Ticket Number", "Date", "Amount", "Start Destination", "End Destination", "Status"}
	if err := w.Write(header); err != nil {
		return c.Status(http.StatusInternalServerError).SendString("Failed to write CSV header")
	}

	for rows.Next() {
		var id, routeNumber, busNumber, ticketNumber, fromStop, toStop, status string
		var transactionDate time.Time
		var amount float64
		if err := rows.Scan(&id, &routeNumber, &busNumber, &ticketNumber, &transactionDate, &amount, &fromStop, &toStop, &status); err != nil {
			continue
		}
		dateStr := transactionDate.Format("2006-01-02 15:04:05")
		record := []string{
			id,
			routeNumber,
			busNumber,
			ticketNumber,
			dateStr,
			fmt.Sprintf("%.2f", amount),
			fromStop,
			toStop,
			status,
		}
		if err := w.Write(record); err != nil {
			continue
		}
	}
	return nil
}

// GenerateDailyReport generates a daily transaction report
func GenerateDailyReport(c *fiber.Ctx) error {
	type GenerateReportRequest struct {
		Date        string `json:"date" validate:"required"`
		RouteFilter string `json:"route_filter"`
		BusFilter   string `json:"bus_filter"`
	}

	var req GenerateReportRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// TODO: Query transactions for the date
	// TODO: Apply filters
	// TODO: Generate report data
	// TODO: Save to database
	// TODO: Return report

	return c.JSON(fiber.Map{
		"reportId":   "report-uuid",
		"data":       fiber.Map{},
		"generatedAt": "",
	})
}

// GenerateAllTimeReport generates an all-time transaction report
func GenerateAllTimeReport(c *fiber.Ctx) error {
	type GenerateReportRequest struct {
		DateFrom    string `json:"date_from" validate:"required"`
		DateTo      string `json:"date_to" validate:"required"`
		RouteFilter string `json:"route_filter"`
		BusFilter   string `json:"bus_filter"`
	}

	var req GenerateReportRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// TODO: Query transactions in date range
	// TODO: Apply filters
	// TODO: Generate report data
	// TODO: Save to database
	// TODO: Return report

	return c.JSON(fiber.Map{
		"reportId": "report-uuid",
		"data":     fiber.Map{},
	})
}

// GenerateTicketSalesReport generates a ticket sales report
func GenerateTicketSalesReport(c *fiber.Ctx) error {
	type GenerateReportRequest struct {
		DateFrom    string `json:"date_from" validate:"required"`
		DateTo      string `json:"date_to" validate:"required"`
		RouteFilter string `json:"route_filter"`
	}

	var req GenerateReportRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Invalid request body",
		})
	}

	// TODO: Query tickets in date range
	// TODO: Include ticket_id, date, route_id, from_stop_id, to_stop_id, amount
	// TODO: Apply filters
	// TODO: Generate report data
	// TODO: Save to database
	// TODO: Return report

	return c.JSON(fiber.Map{
		"reportId": "report-uuid",
		"data": []fiber.Map{},
	})
}

// ExportReport exports a report as CSV
func ExportReport(c *fiber.Ctx) error {
	_ = c.Params("reportId")
	format := c.Query("format", "csv")

	if format != "csv" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"error": "Only CSV format is supported",
		})
	}

	// TODO: Fetch report from database
	// TODO: Convert report data to CSV
	// TODO: Return CSV file for download

	return c.Download("report.csv")
}
