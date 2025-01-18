package knowledge

import (
	"cosmic-dolphin/utils"
	"time"

	"github.com/gocolly/colly"
	"github.com/sirupsen/logrus"
)

func getResourceContents(resource Resource) (Document, error) {
	log.WithFields(logrus.Fields{"resource.id": resource.ID}).Info("Getting content for resource")

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

	err := c.Visit(resource.Source)
	if err != nil {
		logrus.WithFields(logrus.Fields{"error": err}).Error("Failed to visit resource")
		return Document{}, err
	}

	doc := Document{
		ResourceID: *resource.ID,
		Title:      titles,
		Content:    htmlContent,
		Images:     imgs,
		UserID:     resource.UserID,
		CreatedAt:  time.Now(),
	}

	return doc, nil
}
