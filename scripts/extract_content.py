#!/usr/bin/env python3
"""
MarkItDown-based content extraction script with Beautiful Soup.
Extracts structured content from URLs, fetches HTML with Beautiful Soup,
extracts metadata, and converts to markdown with MarkItDown.
"""

import json
import sys
import argparse
import logging
import os
import warnings
import re
import base64
from typing import Dict, List, Any, Optional, Tuple
from pathlib import Path
from urllib.parse import urljoin, urlparse
from io import BytesIO

# Suppress urllib3 SSL warnings before importing other modules
warnings.filterwarnings("ignore", message="urllib3 v2 only supports OpenSSL 1.1.1+")

# Configure SSL certificates using certifi
try:
    import certifi

    os.environ["SSL_CERT_FILE"] = certifi.where()
    os.environ["REQUESTS_CA_BUNDLE"] = certifi.where()
except ImportError:
    pass

try:
    import requests
    from bs4 import BeautifulSoup
    from markitdown import MarkItDown
except ImportError as e:
    print(json.dumps({"error": f"Failed to import required packages: {e}"}))
    sys.exit(1)


def setup_logging(verbose: bool = False):
    """Setup logging configuration."""
    level = logging.DEBUG if verbose else logging.WARNING
    logging.basicConfig(level=level, format="%(asctime)s - %(levelname)s - %(message)s")


def extract_titles_from_markdown(markdown_content: str) -> List[str]:
    """
    Extract titles from markdown content using regex.

    Args:
        markdown_content: The markdown content to extract titles from

    Returns:
        List of extracted titles
    """
    titles = []
    lines = markdown_content.split("\n")

    for line in lines:
        line = line.strip()
        # Match markdown headers (# ## ### etc.)
        if line.startswith("#"):
            # Remove markdown heading markers and clean up
            title = re.sub(r"^#+\s*", "", line).strip()
            if title:
                titles.append(title)

    return titles


def extract_images_from_soup(soup: Any, base_url: str) -> List[Dict[str, Any]]:
    """
    Extract image references from HTML using Beautiful Soup and convert to base64.

    Args:
        soup: BeautifulSoup object of the HTML
        base_url: Base URL for resolving relative image URLs

    Returns:
        List of image dictionaries with 'src', 'alt', and 'base64' keys
    """
    images = []

    # Find all img tags using Beautiful Soup
    img_tags = soup.find_all("img")

    for i, img_tag in enumerate(img_tags):
        src = img_tag.get("src")
        alt = img_tag.get("alt", "")

        if src:
            # Convert relative URLs to absolute
            full_url = urljoin(base_url, src)

            images.append(
                {
                    "src": full_url,
                    "alt": alt if alt else f"Image {i+1}",
                }
            )

    return images


def fetch_html_content(url: str) -> Tuple[str, Any]:
    """
    Fetch HTML content from URL using requests and parse with BeautifulSoup.

    Args:
        url: The URL to fetch HTML from

    Returns:
        Tuple of (html_content, BeautifulSoup object)

    Raises:
        requests.RequestException: If the HTTP request fails
        Exception: For other parsing errors
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }

    response = requests.get(url, headers=headers, timeout=30)
    response.raise_for_status()

    html_content = response.text
    soup = BeautifulSoup(html_content, "html.parser")

    return html_content, soup


def extract_metadata(soup: Any, base_url: str) -> Dict[str, Any]:
    """
    Extract metadata from HTML using BeautifulSoup.

    Args:
        soup: BeautifulSoup object of the HTML
        base_url: Base URL for resolving relative URLs

    Returns:
        Dictionary containing extracted metadata
    """
    metadata = {"title": "", "icon": "", "meta_tags": {}}

    # Extract page title
    title_tag = soup.find("title")
    if title_tag:
        metadata["title"] = title_tag.get_text().strip()

    # Extract icon (favicon)
    icon_selectors = [
        'link[rel="icon"]',
        'link[rel="shortcut icon"]',
        'link[rel="apple-touch-icon"]',
        'link[rel="apple-touch-icon-precomposed"]',
    ]

    for selector in icon_selectors:
        icon_tag = soup.select_one(selector)
        if icon_tag and icon_tag.get("href"):
            icon_url = icon_tag.get("href")
            # Convert relative URLs to absolute
            metadata["icon"] = urljoin(base_url, icon_url)
            break

    # If no icon found, try default favicon.ico
    if not metadata["icon"]:
        parsed_url = urlparse(base_url)
        default_favicon = f"{parsed_url.scheme}://{parsed_url.netloc}/favicon.ico"
        metadata["icon"] = default_favicon

    # Extract meta tags
    meta_tags = soup.find_all("meta")
    for meta in meta_tags:
        name = meta.get("name") or meta.get("property") or meta.get("http-equiv")
        content = meta.get("content")

        if name and content:
            metadata["meta_tags"][name] = content

    return metadata


def extract_content_from_url(url: str) -> Dict[str, Any]:
    """
    Extract content from URL using Beautiful Soup and MarkItDown.

    Args:
        url: The URL to extract content from

    Returns:
        Dictionary containing extracted content and metadata
    """
    try:
        # Fetch HTML content using Beautiful Soup
        html_content, soup = fetch_html_content(url)

        # Extract metadata using Beautiful Soup
        metadata = extract_metadata(soup, url)

        # Initialize MarkItDown converter
        # Try with plugins enabled, fall back to basic initialization for older versions
        try:
            md_converter = MarkItDown(enable_plugins=True)
        except TypeError:
            # Fallback for older versions that don't support enable_plugins parameter
            md_converter = MarkItDown()

        # Convert the HTML content to markdown
        html_bytes = BytesIO(html_content.encode("utf-8"))
        result = md_converter.convert_stream(html_bytes, file_extension=".html")

        if not result or not result.text_content:
            return {"error": "Failed to convert document or no content found"}

        markdown_content = result.text_content

        # Resolve relative links in the markdown content
        markdown_content = resolve_relative_links_in_markdown(markdown_content, url)

        # Extract content similar to the original Go service
        content_data = {
            "titles": [],
            "images": [],
            "markdown_content": markdown_content,
            "metadata": metadata,
            "status": "success",
        }

        # Extract titles from the markdown content
        titles = extract_titles_from_markdown(markdown_content)
        content_data["titles"] = titles

        # Extract images from the HTML content using Beautiful Soup with base64 encoding
        images = extract_images_from_soup(soup, url)
        content_data["images"] = images

        return content_data

    except requests.RequestException as e:
        logging.error(f"Error fetching URL: {e}")
        return {"error": f"Failed to fetch URL: {str(e)}"}
    except Exception as e:
        logging.error(f"Error extracting content: {e}")
        return {"error": f"Extraction failed: {str(e)}"}


def resolve_relative_links_in_markdown(markdown_content: str, base_url: str) -> str:
    """
    Resolve relative links in markdown content using the base URL.

    Args:
        markdown_content: The markdown content with potential relative links
        base_url: Base URL for resolving relative links

    Returns:
        Markdown content with relative links resolved to absolute URLs
    """
    # Pattern to match markdown links: [text](url)
    link_pattern = r"\[([^\]]*)\]\(([^)]+)\)"

    def resolve_link(match):
        text = match.group(1)
        url = match.group(2)

        # Skip if already absolute URL (has scheme)
        if "://" in url:
            return match.group(0)

        # Skip anchors and data URLs
        if url.startswith("#") or url.startswith("data:"):
            return match.group(0)

        # Resolve relative URL
        absolute_url = urljoin(base_url, url)
        return f"[{text}]({absolute_url})"

    return re.sub(link_pattern, resolve_link, markdown_content)


def main():
    """Main function to handle command line arguments and execute extraction."""
    parser = argparse.ArgumentParser(
        description="Extract content from URL using Beautiful Soup and MarkItDown"
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
