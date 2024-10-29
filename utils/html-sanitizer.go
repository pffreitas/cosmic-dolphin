package utils

import "github.com/microcosm-cc/bluemonday"

func newSanitizerPolicy() *bluemonday.Policy {
	p := bluemonday.NewPolicy()
	p.AllowElements("b", "blockquote", "caption", "cite", "code", "data", "dd", "del", "dfn", "dt", "em", "figcaption", "h1", "h2", "h3", "h4", "h5", "h6", "i", "ins", "kbd", "label", "legend", "li", "mark", "meter", "option", "output", "p", "pre", "progress", "q", "rp", "rt", "ruby", "s", "samp", "section", "small", "span", "strong", "sub", "summary", "sup", "td", "textarea", "th", "time", "title", "u", "var", "wbr")
	p.AllowStandardAttributes()
	p.AllowImages()
	p.AllowLists()
	p.AllowTables()
	return p
}

var p = newSanitizerPolicy()

func SanitizeHTML(html string) string {
	return p.Sanitize(html)
}
