package knowledge

import (
	"cosmic-dolphin/job"

	"github.com/sirupsen/logrus"
)

var log = logrus.New()

func processResource(resource Resource) error {
	log.WithFields(logrus.Fields{"resource.source": resource.Source}).Info("Processing resource")

	persistedResource, err := insertResource(resource)
	if err != nil {
		return err
	}

	err = job.InsertJob(GetResourceContentJobArgs{
		Resource: *persistedResource,
	})
	if err != nil {
		return err
	}

	return nil
}

func processDocument(document Document) error {
	log.WithFields(logrus.Fields{"document.title": document.Title}).Info("Processing document")

	persistedDoc, err := insertDocument(document)
	if err != nil {
		return err
	}

	err = job.InsertJob(EmbedDocumentJobArgs{
		DocumentID: *persistedDoc.ID,
	})
	if err != nil {
		log.WithFields(logrus.Fields{"error": err}).Error("Failed to insert embed document job")
		return err
	}

	return nil
}
