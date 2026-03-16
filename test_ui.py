import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Test sign in page
        await page.goto("http://localhost:3001/sign-in")
        print("Saving screenshot for sign in page...")
        await page.screenshot(path="screenshot_signin.png")
        await page.wait_for_selector('input[aria-label="Username or Email"]', timeout=5000)
        print("Found aria-label for sign in page")

        # Test sign up page
        await page.goto("http://localhost:3001/sign-up")
        print("Saving screenshot for sign up page...")
        await page.screenshot(path="screenshot_signup.png")
        await page.wait_for_selector('input[aria-label="Email"]', timeout=5000)
        print("Found aria-label for sign up page")

        # Test forgot password page
        await page.goto("http://localhost:3001/forgot-password")
        print("Saving screenshot for forgot password page...")
        await page.screenshot(path="screenshot_forgot_password.png")
        await page.wait_for_selector('input[aria-label="Email"]', timeout=5000)
        print("Found aria-label for forgot password page")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
