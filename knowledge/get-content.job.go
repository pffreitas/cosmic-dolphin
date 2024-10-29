package knowledge

import (
	"context"
	"cosmic-dolphin/utils"
	"time"

	"github.com/gocolly/colly"
	"github.com/riverqueue/river"
	"github.com/sirupsen/logrus"
)

type GetResourceContentJobArgs struct {
	Resource Resource `json:"resource"`
}

func (GetResourceContentJobArgs) Kind() string { return "GetResourceContent" }

type GetResourceContentJobWorker struct {
	river.WorkerDefaults[GetResourceContentJobArgs]
}

func (w *GetResourceContentJobWorker) Work(ctx context.Context, job *river.Job[GetResourceContentJobArgs]) error {
	log.WithFields(logrus.Fields{"resource.id": job.Args.Resource.ID}).Info("Getting content for resource")

	var htmlContent string
	var imgs []Image = make([]Image, 0)
	var titles []string = make([]string, 0)

	c := colly.NewCollector()

	c.OnHTML("body", func(e *colly.HTMLElement) {
		rawHTML, err := e.DOM.Html()
		if err != nil {
			logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to get raw HTML")
			rawHTML = e.Text
		}

		htmlContent = utils.SanitizeHTML(rawHTML)
	})

	c.OnHTML("h1", func(e *colly.HTMLElement) {
		titles = append(titles, e.Text)
	})

	c.OnHTML("title", func(e *colly.HTMLElement) {
		titles = append(titles, e.Text)
	})

	c.OnHTML("img", func(e *colly.HTMLElement) {
		imgSrc := e.Attr("src")
		alt := e.Attr("alt")

		imgs = append(imgs, Image{
			Src: imgSrc,
			Alt: alt,
		})
	})

	c.Visit(job.Args.Resource.Source)

	doc := Document{
		ResourceID: *job.Args.Resource.ID,
		Title:      titles,
		Content:    htmlContent,
		Images:     imgs,
		UserID:     job.Args.Resource.UserID,
		CreatedAt:  time.Now(),
	}

	insertDocument(doc)

	return nil
}
