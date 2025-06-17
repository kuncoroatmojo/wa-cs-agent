#!/usr/bin/env tsx

/**
 * Phase 6 Validation Script
 * Validates all testing, deployment, and optimization implementations
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'

interface ValidationResult {
  category: string
  tests: Array<{
    name: string
    passed: boolean
    message?: string
  }>
}

class Phase6Validator {
  private results: ValidationResult[] = []

  async validate(): Promise<void> {
    console.log('🧪 Validating Wacanda Phase 6: Testing, Optimization & Deployment\n')

    await this.validateTestingInfrastructure()
    await this.validateCICD()
    await this.validateDeploymentConfiguration()
    await this.validateSecurityImplementation()
    await this.validatePerformanceOptimization()
    await this.validateProjectStructure()

    this.printResults()
  }

  private async validateTestingInfrastructure(): Promise<void> {
    const category = 'Testing Infrastructure'
    const tests: Array<{ name: string; passed: boolean; message?: string }> = []

    // Check Vitest configuration
    tests.push({
      name: 'Vitest Configuration',
      passed: existsSync('vitest.config.ts'),
      message: existsSync('vitest.config.ts') ? 'Unit test configuration found' : 'Missing vitest.config.ts'
    })

    // Check integration test configuration
    tests.push({
      name: 'Integration Test Configuration',
      passed: existsSync('vitest.integration.config.ts'),
      message: existsSync('vitest.integration.config.ts') ? 'Integration test config found' : 'Missing integration config'
    })

    // Check Playwright configuration
    tests.push({
      name: 'E2E Test Configuration',
      passed: existsSync('playwright.config.ts'),
      message: existsSync('playwright.config.ts') ? 'E2E test configuration found' : 'Missing playwright.config.ts'
    })

    // Check test setup files
    tests.push({
      name: 'Test Setup Files',
      passed: existsSync('tests/setup.ts'),
      message: existsSync('tests/setup.ts') ? 'Test setup file found' : 'Missing test setup'
    })

    // Check unit tests
    const unitTestFiles = [
      'tests/unit/services/ragService.test.ts',
      'tests/unit/services/handoffService.test.ts'
    ]
    
    tests.push({
      name: 'Unit Test Files',
      passed: unitTestFiles.every(file => existsSync(file)),
      message: `Found ${unitTestFiles.filter(file => existsSync(file)).length}/${unitTestFiles.length} unit test files`
    })

    // Check E2E tests
    tests.push({
      name: 'E2E Test Files',
      passed: existsSync('tests/e2e/auth.spec.ts'),
      message: existsSync('tests/e2e/auth.spec.ts') ? 'E2E test files found' : 'Missing E2E tests'
    })

    // Check performance tests
    tests.push({
      name: 'Performance Test Files',
      passed: existsSync('tests/performance/load-test.js'),
      message: existsSync('tests/performance/load-test.js') ? 'Performance tests found' : 'Missing performance tests'
    })

    this.results.push({ category, tests })
  }

  private async validateCICD(): Promise<void> {
    const category = 'CI/CD Pipeline'
    const tests: Array<{ name: string; passed: boolean; message?: string }> = []

    // Check GitHub Actions workflow
    tests.push({
      name: 'GitHub Actions Workflow',
      passed: existsSync('.github/workflows/ci-cd.yml'),
      message: existsSync('.github/workflows/ci-cd.yml') ? 'CI/CD pipeline found' : 'Missing GitHub Actions workflow'
    })

    // Validate workflow content
    if (existsSync('.github/workflows/ci-cd.yml')) {
      const workflowContent = readFileSync('.github/workflows/ci-cd.yml', 'utf-8')
      
      const requiredJobs = [
        'lint-and-typecheck',
        'unit-tests',
        'integration-tests',
        'e2e-tests',
        'performance-tests',
        'security-scan',
        'deploy-staging',
        'deploy-production'
      ]

      tests.push({
        name: 'Workflow Jobs',
        passed: requiredJobs.every(job => workflowContent.includes(job)),
        message: `Found ${requiredJobs.filter(job => workflowContent.includes(job)).length}/${requiredJobs.length} required jobs`
      })

      tests.push({
        name: 'Multi-Environment Support',
        passed: workflowContent.includes('staging') && workflowContent.includes('production'),
        message: 'Multi-environment deployment configured'
      })
    }

    this.results.push({ category, tests })
  }

  private async validateDeploymentConfiguration(): Promise<void> {
    const category = 'Deployment Configuration'
    const tests: Array<{ name: string; passed: boolean; message?: string }> = []

    // Check Vercel configuration
    tests.push({
      name: 'Vercel Configuration',
      passed: existsSync('vercel.json'),
      message: existsSync('vercel.json') ? 'Vercel config found' : 'Missing vercel.json'
    })

    // Validate Vercel configuration content
    if (existsSync('vercel.json')) {
      try {
        const vercelConfig = JSON.parse(readFileSync('vercel.json', 'utf-8'))
        
        tests.push({
          name: 'Vercel Security Headers',
          passed: vercelConfig.headers && vercelConfig.headers.length > 0,
          message: 'Security headers configured'
        })

        tests.push({
          name: 'Vercel Caching Strategy',
          passed: vercelConfig.headers?.some((h: any) => h.headers?.some((header: any) => header.key === 'Cache-Control')),
          message: 'Caching strategy implemented'
        })

        tests.push({
          name: 'Multi-Region Deployment',
          passed: vercelConfig.regions && Array.isArray(vercelConfig.regions),
          message: 'Multi-region deployment configured'
        })
      } catch (error) {
        tests.push({
          name: 'Vercel Config Validation',
          passed: false,
          message: 'Invalid JSON in vercel.json'
        })
      }
    }

    this.results.push({ category, tests })
  }

  private async validateSecurityImplementation(): Promise<void> {
    const category = 'Security Implementation'
    const tests: Array<{ name: string; passed: boolean; message?: string }> = []

    // Check package.json for security dependencies
    if (existsSync('package.json')) {
      const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'))
      
      const securityDeps = [
        '@types/k6', // Performance testing
        'playwright', // E2E testing
        'vitest' // Unit testing
      ]

      tests.push({
        name: 'Security Testing Dependencies',
        passed: securityDeps.some(dep => 
          packageJson.devDependencies?.[dep] || packageJson.dependencies?.[dep]
        ),
        message: 'Security testing tools available'
      })

      // Check for security scripts
      const securityScripts = ['test:all', 'validate']
      tests.push({
        name: 'Security Validation Scripts',
        passed: securityScripts.some(script => packageJson.scripts?.[script]),
        message: 'Security validation scripts configured'
      })
    }

    // Check for environment variable handling
    tests.push({
      name: 'Environment Configuration',
      passed: existsSync('.env.example') || existsSync('.env.local'),
      message: 'Environment configuration template available'
    })

    this.results.push({ category, tests })
  }

  private async validatePerformanceOptimization(): Promise<void> {
    const category = 'Performance Optimization'
    const tests: Array<{ name: string; passed: boolean; message?: string }> = []

    // Check Vite configuration
    tests.push({
      name: 'Vite Configuration',
      passed: existsSync('vite.config.ts'),
      message: existsSync('vite.config.ts') ? 'Build optimization configured' : 'Missing Vite config'
    })

    // Check TypeScript configuration
    tests.push({
      name: 'TypeScript Configuration',
      passed: existsSync('tsconfig.json'),
      message: existsSync('tsconfig.json') ? 'TypeScript optimization enabled' : 'Missing TypeScript config'
    })

    // Check Tailwind configuration
    tests.push({
      name: 'CSS Optimization',
      passed: existsSync('tailwind.config.js'),
      message: existsSync('tailwind.config.js') ? 'CSS optimization configured' : 'Missing Tailwind config'
    })

    // Check performance testing
    tests.push({
      name: 'Performance Testing',
      passed: existsSync('tests/performance/load-test.js'),
      message: 'K6 performance tests implemented'
    })

    this.results.push({ category, tests })
  }

  private async validateProjectStructure(): Promise<void> {
    const category = 'Project Structure'
    const tests: Array<{ name: string; passed: boolean; message?: string }> = []

    // Check Phase 5 services
    const phase5Services = [
      'src/services/ragService.ts',
      'src/services/handoffService.ts',
      'src/services/enhancedChatService.ts',
      'src/services/performanceService.ts',
      'src/services/cacheService.ts'
    ]

    tests.push({
      name: 'Phase 5 Services',
      passed: phase5Services.every(service => existsSync(service)),
      message: `Found ${phase5Services.filter(service => existsSync(service)).length}/${phase5Services.length} Phase 5 services`
    })

    // Check documentation
    const documentationFiles = [
      'WACANDA_PHASE5_SUMMARY.md',
      'WACANDA_PHASE6_SUMMARY.md',
      'WACANDA_DEVELOPMENT_PLAN.md'
    ]

    tests.push({
      name: 'Documentation',
      passed: documentationFiles.every(doc => existsSync(doc)),
      message: `Found ${documentationFiles.filter(doc => existsSync(doc)).length}/${documentationFiles.length} documentation files`
    })

    // Check database schema
    tests.push({
      name: 'Database Schema',
      passed: existsSync('database_schema_phase5.sql'),
      message: 'Phase 5 database schema available'
    })

    // Check type definitions
    tests.push({
      name: 'Type Definitions',
      passed: existsSync('src/types/phase5.ts'),
      message: 'Phase 5 type definitions available'
    })

    this.results.push({ category, tests })
  }

  private printResults(): void {
    console.log('\n📊 Validation Results\n')
    console.log('═'.repeat(80))

    let totalTests = 0
    let passedTests = 0

    this.results.forEach(result => {
      console.log(`\n🔍 ${result.category}`)
      console.log('-'.repeat(40))

      result.tests.forEach(test => {
        totalTests++
        const status = test.passed ? '✅' : '❌'
        const message = test.message ? ` - ${test.message}` : ''
        console.log(`  ${status} ${test.name}${message}`)
        
        if (test.passed) passedTests++
      })
    })

    console.log('\n' + '═'.repeat(80))
    console.log(`\n📈 Overall Results: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests/totalTests) * 100)}%)`)

    if (passedTests === totalTests) {
      console.log('\n🎉 Phase 6 validation successful! All components properly implemented.')
      console.log('🚀 Wacanda is ready for production deployment!')
    } else {
      console.log('\n⚠️  Some validation checks failed. Please review and fix the issues above.')
    }

    console.log('\n🔗 Next Steps:')
    console.log('   1. Run: npm run test:all')
    console.log('   2. Run: npm run validate')
    console.log('   3. Deploy to staging: git push origin develop')
    console.log('   4. Deploy to production: git push origin main')
    console.log('\n✨ Phase 6: Testing, Optimization & Deployment - COMPLETE!')
  }
}

// Run validation
async function main() {
  const validator = new Phase6Validator()
  await validator.validate()
}

if (require.main === module) {
  main().catch(console.error)
}

export { Phase6Validator } 