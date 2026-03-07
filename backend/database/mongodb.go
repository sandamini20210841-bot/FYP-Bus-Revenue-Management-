package database

import (
	"context"
	"log"
	"time"

	"github.com/busticket/backend/config"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var MongoDB *mongo.Client
var MongoDBName string

func InitMongoDB(cfg *config.Config) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, options.Client().ApplyURI(cfg.MongoURL))
	if err != nil {
		return err
	}

	// Test connection
	if err := client.Ping(ctx, nil); err != nil {
		return err
	}

	MongoDB = client
	MongoDBName = cfg.MongoDBName

	log.Println("✅ MongoDB connected successfully")
	return nil
}

func CloseMongoDB() error {
	if MongoDB != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return MongoDB.Disconnect(ctx)
	}
	return nil
}

// Helper functions
func GetMongoCollection(collectionName string) *mongo.Collection {
	return MongoDB.Database(MongoDBName).Collection(collectionName)
}
