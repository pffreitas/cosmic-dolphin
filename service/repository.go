package service

import (
	"cosmic-dolphin/config"
	"cosmic-dolphin/model"
	"database/sql"
	"fmt"
	"log"
	"time"

	_ "github.com/lib/pq"
	"github.com/pgvector/pgvector-go"
)

func StoreDocument(doc model.Document) error {
	connStr := config.GetConfig(config.PgConnString)
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	_, err = db.Exec("INSERT INTO documents (created_at, embedding, body) VALUES ($1, $2, $3)", time.Now(), pgvector.NewVector(doc.Embeddings), doc.Body)
	if err != nil {
		log.Fatal(err)
	}

	return nil
}

func SelectDocuments(embedding []float32) ([]model.Document, error) {
	connStr := config.GetConfig(config.PgConnString)
	db, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	rows, err := db.Query("SELECT id, created_at, body, 1 - (embedding <=> $1) as sim FROM documents ORDER BY embedding <=> $1 LIMIT 5", pgvector.NewVector(embedding))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var documents []model.Document
	for rows.Next() {
		var doc model.Document
		var sim float64
		if err := rows.Scan(&doc.ID, &doc.CreatedAt, &doc.Body, &sim); err != nil {
			return nil, err
		}
		documents = append(documents, doc)
		fmt.Println("ID:", doc.ID)
		fmt.Println("Similarity:", sim)
		fmt.Println("------")
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return documents, nil
}
