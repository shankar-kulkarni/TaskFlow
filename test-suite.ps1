#!/usr/bin/env pwsh
# TaskFlow SaaS - Automated Test Suite
# Date: February 13, 2026
# Usage: .\test-suite.ps1

param(
    [switch]$Full,
    [switch]$API,
    [switch]$Web,
    [switch]$Database
)

Write-Host "==> TaskFlow SaaS - Automated Test Suite" -ForegroundColor Cyan
Write-Host "Date: $(Get-Date)" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Yellow

# Test configuration
$apiUrl = "http://localhost:3000"
$webUrl = "http://localhost:5177"
$tenantId = "test-tenant"
$testResults = @()

function Test-API {
    Write-Host "`n[SEARCH] Testing API Endpoints..." -ForegroundColor Blue

    # Health Check
    try {
        $response = Invoke-WebRequest -Uri "$apiUrl/health" -Method GET -TimeoutSec 10
        if ($response.StatusCode -eq 200 -and ($response.Content | ConvertFrom-Json).status -eq "ok") {
            Write-Host "✅ Health Check: PASSED" -ForegroundColor Green
            $testResults += "API-Health:PASSED"
        } else {
            Write-Host "❌ Health Check: FAILED" -ForegroundColor Red
            $testResults += "API-Health:FAILED"
        }
    } catch {
        Write-Host "❌ Health Check: ERROR - $($_.Exception.Message)" -ForegroundColor Red
        $testResults += "API-Health:ERROR"
    }

    # Root Endpoint
    try {
        $response = Invoke-WebRequest -Uri "$apiUrl/" -Method GET -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            $data = $response.Content | ConvertFrom-Json
            if ($data.message -and $data.version) {
                Write-Host "✅ Root Endpoint: PASSED" -ForegroundColor Green
                $testResults += "API-Root:PASSED"
            } else {
                Write-Host "❌ Root Endpoint: FAILED - Invalid response" -ForegroundColor Red
                $testResults += "API-Root:FAILED"
            }
        }
    } catch {
        Write-Host "❌ Root Endpoint: ERROR - $($_.Exception.Message)" -ForegroundColor Red
        $testResults += "API-Root:ERROR"
    }

    # Tasks Endpoint
    try {
        $headers = @{"X-Tenant-ID" = $tenantId}
        $response = Invoke-WebRequest -Uri "$apiUrl/api/v1/tasks" -Method GET -Headers $headers -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-Host "✅ Tasks API: PASSED" -ForegroundColor Green
            $testResults += "API-Tasks:PASSED"
        }
    } catch {
        Write-Host "❌ Tasks API: ERROR - $($_.Exception.Message)" -ForegroundColor Red
        $testResults += "API-Tasks:ERROR"
    }
}

function Test-Web {
    Write-Host "`n[WEB] Testing Web Client..." -ForegroundColor Blue

    # Web Server Response
    try {
        $response = Invoke-WebRequest -Uri "$webUrl/" -Method GET -TimeoutSec 10
        if ($response.StatusCode -eq 200 -and $response.Content.Length -gt 100) {
            Write-Host "✅ Web Server: PASSED" -ForegroundColor Green
            $testResults += "Web-Server:PASSED"
        } else {
            Write-Host "❌ Web Server: FAILED" -ForegroundColor Red
            $testResults += "Web-Server:FAILED"
        }
    } catch {
        Write-Host "❌ Web Server: ERROR - $($_.Exception.Message)" -ForegroundColor Red
        $testResults += "Web-Server:ERROR"
    }
}

function Test-Database {
    Write-Host "`n[DB] Testing Database Connection..." -ForegroundColor Blue

    # Check Docker containers
    $containers = docker ps --format "{{.Names}}:{{.Status}}"
    $postgresRunning = $containers | Where-Object { $_ -like "*postgres*" -and $_ -like "*Up*" }
    $apiRunning = $containers | Where-Object { $_ -like "*task-service*" -and $_ -like "*Up*" }

    if ($postgresRunning) {
        Write-Host "✅ PostgreSQL: RUNNING" -ForegroundColor Green
        $testResults += "DB-Postgres:PASSED"
    } else {
        Write-Host "❌ PostgreSQL: NOT RUNNING" -ForegroundColor Red
        $testResults += "DB-Postgres:FAILED"
    }

    if ($apiRunning) {
        Write-Host "✅ Task Service: RUNNING" -ForegroundColor Green
        $testResults += "DB-API:PASSED"
    } else {
        Write-Host "❌ Task Service: NOT RUNNING" -ForegroundColor Red
        $testResults += "DB-API:FAILED"
    }
}

function Test-Build {
    Write-Host "`n[BUILD] Testing Build Process..." -ForegroundColor Blue

    # Test API build
    Push-Location "services/task-service"
    try {
        $result = npm run build 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ API Build: PASSED" -ForegroundColor Green
            $testResults += "Build-API:PASSED"
        } else {
            Write-Host "❌ API Build: FAILED" -ForegroundColor Red
            $testResults += "Build-API:FAILED"
        }
    } catch {
        Write-Host "❌ API Build: ERROR - $($_.Exception.Message)" -ForegroundColor Red
        $testResults += "Build-API:ERROR"
    }
    Pop-Location

    # Test Web build
    Push-Location "clients/web"
    try {
        $result = npm run build 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Web Build: PASSED" -ForegroundColor Green
            $testResults += "Build-Web:PASSED"
        } else {
            Write-Host "❌ Web Build: FAILED" -ForegroundColor Red
            $testResults += "Build-Web:FAILED"
        }
    } catch {
        Write-Host "❌ Web Build: ERROR - $($_.Exception.Message)" -ForegroundColor Red
        $testResults += "Build-Web:ERROR"
    }
    Pop-Location
}

function Show-Results {
    Write-Host "`n[CHART] Test Results Summary" -ForegroundColor Cyan
    Write-Host "========================" -ForegroundColor Yellow

    $passed = ($testResults | Where-Object { $_ -like "*:PASSED" }).Count
    $failed = ($testResults | Where-Object { $_ -like "*:FAILED" }).Count
    $errors = ($testResults | Where-Object { $_ -like "*:ERROR" }).Count
    $total = $testResults.Count

    Write-Host "Total Tests: $total" -ForegroundColor White
    Write-Host "Passed: $passed" -ForegroundColor Green
    Write-Host "Failed: $failed" -ForegroundColor Red
    Write-Host "Errors: $errors" -ForegroundColor Yellow

    Write-Host "`n[LIST] Detailed Results:" -ForegroundColor Gray
    foreach ($result in $testResults) {
        $parts = $result -split ":"
        $test = $parts[0]
        $status = $parts[1]

        switch ($status) {
            "PASSED" { Write-Host "[PASS] $test" -ForegroundColor Green }
            "FAILED" { Write-Host "[FAIL] $test" -ForegroundColor Red }
            "ERROR" { Write-Host "[WARN] $test" -ForegroundColor Yellow }
        }
    }

    # Save results to file
    $timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
    $resultFile = "test-results_$timestamp.txt"
    $testResults | Out-File -FilePath $resultFile
    Write-Host "`n[DISK] Results saved to: $resultFile" -ForegroundColor Gray
}

# Main test execution
if ($Full -or (-not $API -and -not $Web -and -not $Database)) {
    Test-Database
    Test-API
    Test-Web
    Test-Build
} else {
    if ($Database) { Test-Database }
    if ($API) { Test-API }
    if ($Web) { Test-Web }
}

Show-Results

Write-Host "`n[TARGET] Test Suite Complete!" -ForegroundColor Cyan
Write-Host "Use parameters: -API, -Web, -Database, or -Full for comprehensive testing" -ForegroundColor Gray