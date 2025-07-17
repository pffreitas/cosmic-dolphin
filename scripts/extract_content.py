#!/usr/bin/env python3
"""
Docling-based content extraction script.
Extracts structured content from URLs and outputs JSON.
"""

import json
import sys
import argparse
import logging
from typing import Dict, List, Any
from pathlib import Path

try:
    from docling.document_converter import DocumentConverter
    from docling.datamodel.base_models import InputFormat
    from docling.datamodel.pipeline_options import PdfPipelineOptions
    from docling.document_converter import PdfFormatOption
except ImportError as e:
    print(json.dumps({"error": f"Failed to import docling: {e}"}))
    sys.exit(1)


def setup_logging(verbose: bool = False):
    """Setup logging configuration."""
    level = logging.DEBUG if verbose else logging.WARNING
    logging.basicConfig(level=level, format="%(asctime)s - %(levelname)s - %(message)s")


def extract_content_from_url(url: str) -> Dict[str, Any]:
    """
    Extract content from URL using docling.

    Args:
        url: The URL to extract content from

    Returns:
        Dictionary containing extracted content in format compatible with Go service
    """
    try:
        # Initialize document converter
        converter = DocumentConverter()

        # Convert the document from URL
        result = converter.convert(source=url)

        if not result or not result.document:
            return {"error": "Failed to convert document"}

        doc = result.document

        # Extract content similar to the original Go service
        content_data = {
            "html_content": "",
            "titles": [],
            "images": [],
            "markdown_content": "",
            "status": "success",
        }

        # Get markdown content for better structure preservation
        content_data["markdown_content"] = doc.export_to_markdown()

        # Extract titles from the document structure
        titles = []
        for item in doc.texts:
            if item.label in ["title", "section_header", "document_header"]:
                titles.append(item.text.strip())

        # If no structured titles found, try to extract from markdown
        if not titles:
            lines = content_data["markdown_content"].split("\n")
            for line in lines:
                line = line.strip()
                if line.startswith("#"):
                    # Remove markdown heading markers
                    title = line.lstrip("#").strip()
                    if title:
                        titles.append(title)

        content_data["titles"] = titles

        # Extract images
        images = []
        for picture in doc.pictures:
            image_data = {"src": "", "alt": ""}

            # Try to get image source from annotations or captions
            if picture.annotations:
                for annotation in picture.annotations:
                    if hasattr(annotation, "text"):
                        image_data["alt"] = annotation.text

            # If we have a caption, use it as alt text
            if hasattr(picture, "caption") and picture.caption:
                image_data["alt"] = (
                    picture.caption.text
                    if hasattr(picture.caption, "text")
                    else str(picture.caption)
                )

            # For web content, we might not have direct image URLs
            # but we can note that images exist
            if picture.image:
                image_data["src"] = (
                    f"image_{picture.prov[0].page_no}_{picture.prov[0].bbox.l}"
                )

            images.append(image_data)

        content_data["images"] = images

        # For HTML content, use markdown as a structured representation
        # since direct HTML extraction from web pages via docling focuses on content structure
        content_data["html_content"] = content_data["markdown_content"]

        return content_data

    except Exception as e:
        logging.error(f"Error extracting content: {e}")
        return {"error": f"Extraction failed: {str(e)}"}


def main():
    """Main function to handle command line arguments and execute extraction."""
    parser = argparse.ArgumentParser(
        description="Extract content from URL using docling"
    )
    parser.add_argument("url", help="URL to extract content from")
    parser.add_argument(
        "-v", "--verbose", action="store_true", help="Enable verbose logging"
    )
    parser.add_argument("-o", "--output", help="Output file path (default: stdout)")

    args = parser.parse_args()

    setup_logging(args.verbose)

    if not args.url:
        print(json.dumps({"error": "URL is required"}))
        sys.exit(1)

    # Extract content
    result = extract_content_from_url(args.url)

    # Output result as JSON
    json_output = json.dumps(result, indent=2, ensure_ascii=False)

    if args.output:
        try:
            with open(args.output, "w", encoding="utf-8") as f:
                f.write(json_output)
        except Exception as e:
            print(json.dumps({"error": f"Failed to write output file: {e}"}))
            sys.exit(1)
    else:
        print(json_output)


if __name__ == "__main__":
    main()
