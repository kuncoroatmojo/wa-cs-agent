import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should display login page for unauthenticated users', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Sign in to Wacanda')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('should show validation errors for invalid email', async ({ page }) => {
    await page.fill('input[type="email"]', 'invalid-email')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')
    
    await expect(page.locator('.error-message')).toContainText('Invalid email format')
  })

  test('should show validation errors for empty fields', async ({ page }) => {
    await page.click('button[type="submit"]')
    
    await expect(page.locator('.error-message')).toContainText('Email is required')
  })

  test('should login with valid credentials', async ({ page }) => {
    // Mock successful authentication
    await page.route('**/auth/v1/token**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          user: {
            id: 'test-user-id',
            email: 'test@example.com'
          }
        })
      })
    })

    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')

    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('h1')).toContainText('Dashboard')
  })

  test('should handle login errors gracefully', async ({ page }) => {
    // Mock authentication error
    await page.route('**/auth/v1/token**', async route => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Invalid credentials'
        })
      })
    })

    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    await expect(page.locator('.error-message')).toContainText('Invalid credentials')
    await expect(page).toHaveURL('/')
  })

  test('should logout successfully', async ({ page }) => {
    // Mock authenticated state
    await page.addInitScript(() => {
      localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'mock-token',
        user: { id: 'test-user-id', email: 'test@example.com' }
      }))
    })

    await page.goto('/dashboard')
    
    // Mock logout
    await page.route('**/auth/v1/logout**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{}'
      })
    })

    await page.click('[data-testid="user-menu"]')
    await page.click('[data-testid="logout-button"]')

    // Should redirect to login page
    await expect(page).toHaveURL('/')
    await expect(page.locator('h1')).toContainText('Sign in to Wacanda')
  })

  test('should persist authentication state on page refresh', async ({ page }) => {
    // Mock authenticated state
    await page.addInitScript(() => {
      localStorage.setItem('supabase.auth.token', JSON.stringify({
        access_token: 'mock-token',
        user: { id: 'test-user-id', email: 'test@example.com' }
      }))
    })

    await page.goto('/dashboard')
    await page.reload()

    // Should remain on dashboard
    await expect(page).toHaveURL('/dashboard')
    await expect(page.locator('h1')).toContainText('Dashboard')
  })

  test('should redirect unauthenticated users from protected routes', async ({ page }) => {
    await page.goto('/dashboard/conversations')
    
    // Should redirect to login
    await expect(page).toHaveURL('/')
  })

  test('should show loading state during authentication', async ({ page }) => {
    // Mock slow authentication
    await page.route('**/auth/v1/token**', async route => {
      await new Promise(resolve => setTimeout(resolve, 2000))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-access-token',
          user: { id: 'test-user-id', email: 'test@example.com' }
        })
      })
    })

    await page.fill('input[type="email"]', 'test@example.com')
    await page.fill('input[type="password"]', 'password123')
    await page.click('button[type="submit"]')

    // Should show loading state
    await expect(page.locator('.loading-spinner')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeDisabled()
  })
}) 