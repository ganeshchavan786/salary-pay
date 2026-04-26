# Requirements Document

## Introduction

This document specifies requirements for integrating actual attendance data from the attendance table into the salary calculation system. Currently, the salary calculation uses default attendance values (present_days=0, absent_days=26) for all employees, regardless of their actual attendance records. This feature will fetch real attendance data for each employee during the payroll period and use it to calculate accurate salaries, while gracefully handling employees with no attendance records.

## Glossary

- **Salary_Calculator**: The backend service responsible for computing employee salaries (`app/utils/salary_calculator.py`)
- **Attendance_Service**: The backend service that queries and aggregates attendance data from the attendance table
- **Payroll_Period**: A defined time range (start_date to end_date) for which salaries are calculated
- **Attendance_Record**: A single check-in or check-out entry in the attendance table with date, time, and employee ID
- **Present_Day**: A calendar day where an employee has at least one valid check-in record
- **Absent_Day**: A working day where an employee has no attendance records
- **Overtime_Hours**: Total hours worked beyond the standard shift duration
- **LOP**: Loss of Pay - salary deduction for absent days
- **Salary_Calculation_API**: The FastAPI router endpoint that triggers salary calculations (`/v1/payroll/calculate/{period_id}`)
- **Admin_Panel**: The React-based web interface for administrators to manage payroll

## Requirements

### Requirement 1: Fetch Attendance Data for Payroll Period

**User Story:** As a payroll administrator, I want the system to automatically fetch actual attendance data for each employee during salary calculation, so that salaries reflect real attendance instead of default values.

#### Acceptance Criteria

1. WHEN salary calculation is triggered for a Payroll_Period, THE Attendance_Service SHALL query all Attendance_Records where check_in_time falls between the period's start_date and end_date
2. FOR each employee in the payroll calculation, THE Attendance_Service SHALL aggregate their Attendance_Records to compute present_days, absent_days, leave_days, and overtime_hours
3. THE Attendance_Service SHALL return attendance data grouped by employee_id with fields: present_days (integer), absent_days (integer), leave_days (integer), overtime_hours (float), total_days (integer), working_days (integer)
4. WHEN an employee has no Attendance_Records in the Payroll_Period, THE Attendance_Service SHALL return default values: present_days=0, absent_days=26, leave_days=0, overtime_hours=0, total_days=30, working_days=26
5. THE Salary_Calculator SHALL use the attendance data from Attendance_Service instead of hardcoded defaults when computing salary components

### Requirement 2: Calculate Present Days from Attendance Records

**User Story:** As a payroll administrator, I want present days to be counted based on actual check-in records, so that employees are credited for days they attended.

#### Acceptance Criteria

1. THE Attendance_Service SHALL count a calendar day as a Present_Day IF at least one Attendance_Record exists for that employee on that date with a non-null check_in_time
2. WHEN multiple Attendance_Records exist for the same employee on the same date, THE Attendance_Service SHALL count it as one Present_Day
3. THE Attendance_Service SHALL exclude weekends and holidays from the present_days count IF the attendance policy marks them as non-working days
4. THE present_days value SHALL be an integer greater than or equal to zero

### Requirement 3: Calculate Absent Days from Working Days

**User Story:** As a payroll administrator, I want absent days to be calculated as working days minus present days, so that LOP deductions are accurate.

#### Acceptance Criteria

1. THE Attendance_Service SHALL calculate absent_days using the formula: working_days - present_days - leave_days
2. THE working_days value SHALL be determined by counting weekdays in the Payroll_Period excluding holidays
3. WHEN present_days equals zero and leave_days equals zero, THE absent_days SHALL equal working_days
4. THE absent_days value SHALL be an integer greater than or equal to zero

### Requirement 4: Calculate Overtime Hours from Check-In and Check-Out Times

**User Story:** As a payroll administrator, I want overtime hours to be calculated from actual check-in and check-out times, so that employees are compensated for extra work.

#### Acceptance Criteria

1. WHEN an Attendance_Record has both check_in_time and check_out_time, THE Attendance_Service SHALL calculate working_hours as the time difference in hours
2. THE Attendance_Service SHALL calculate overtime_hours as: MAX(0, working_hours - standard_shift_hours) for each day
3. THE Attendance_Service SHALL sum overtime_hours across all days in the Payroll_Period for each employee
4. WHEN check_in_time or check_out_time is null, THE Attendance_Service SHALL exclude that record from overtime calculation
5. THE overtime_hours value SHALL be a float rounded to two decimal places

### Requirement 5: Integrate Attendance Data into Salary Calculation

**User Story:** As a payroll administrator, I want the salary calculator to use actual attendance data when computing gross salary, deductions, and net pay, so that payslips are accurate.

#### Acceptance Criteria

1. WHEN Salary_Calculator computes salary for an employee, THE Salary_Calculator SHALL call Attendance_Service to fetch attendance data for that employee and Payroll_Period
2. THE Salary_Calculator SHALL pass present_days, absent_days, and overtime_hours to the salary computation logic
3. THE Salary_Calculator SHALL calculate LOP deduction using the formula: (basic_salary / working_days) * absent_days
4. THE Salary_Calculator SHALL calculate overtime_amount using overtime_hours and the employee's hourly rate
5. THE Salary_Calculator SHALL store present_days, absent_days, leave_days, and overtime_hours in the SalaryCalculation record for audit purposes

### Requirement 6: Handle Employees with Zero Attendance

**User Story:** As a payroll administrator, I want the system to handle employees with no attendance records gracefully, so that salary calculation completes without errors and applies appropriate deductions.

#### Acceptance Criteria

1. WHEN an employee has zero Attendance_Records in the Payroll_Period, THE Attendance_Service SHALL return present_days=0 and absent_days=26
2. THE Salary_Calculator SHALL calculate full LOP deduction for employees with present_days=0
3. THE Salary_Calculator SHALL set overtime_hours=0 and overtime_amount=0 for employees with no attendance
4. THE Salary_Calculator SHALL successfully create a SalaryCalculation record with net_salary reflecting full LOP deduction
5. THE system SHALL NOT raise errors or skip employees with zero attendance during batch salary calculation

### Requirement 7: Display Attendance Summary in Salary Calculation UI

**User Story:** As a payroll administrator, I want to see attendance summary (present days, absent days, overtime hours) in the salary calculation results table, so that I can verify calculations before approval.

#### Acceptance Criteria

1. THE Admin_Panel salary calculation results table SHALL display present_days for each employee
2. THE Admin_Panel salary calculation results table SHALL display absent_days for each employee
3. THE Admin_Panel salary calculation results table SHALL display overtime_hours for each employee
4. WHEN an employee has present_days=0, THE Admin_Panel SHALL display a warning indicator "⚠ No attendance records" next to the employee name
5. THE attendance summary columns SHALL be visible without requiring horizontal scrolling on standard desktop screens (1920x1080)

### Requirement 8: Support Payslip Generation for All Employees

**User Story:** As a payroll administrator, I want to generate payslips for all employees including those with zero attendance, so that every employee receives documentation of their salary calculation.

#### Acceptance Criteria

1. THE Salary_Calculation_API SHALL allow payslip generation for any employee with a SalaryCalculation record regardless of present_days value
2. THE payslip document SHALL display present_days, absent_days, leave_days, and overtime_hours in the attendance section
3. WHEN present_days=0, THE payslip SHALL show LOP deduction amount and explanation "Loss of Pay for absent days"
4. THE payslip SHALL display net_salary as zero or negative IF total deductions exceed gross_salary
5. THE payslip generation endpoint SHALL return HTTP 200 with PDF content for employees with zero attendance

### Requirement 9: Validate Payroll Period Date Range

**User Story:** As a payroll administrator, I want the system to validate that the payroll period has valid start and end dates, so that attendance queries return correct data.

#### Acceptance Criteria

1. WHEN salary calculation is triggered, THE Salary_Calculation_API SHALL verify that the Payroll_Period has non-null start_date and end_date
2. THE Salary_Calculation_API SHALL verify that start_date is less than or equal to end_date
3. IF start_date or end_date is null, THE Salary_Calculation_API SHALL return HTTP 400 with error message "Invalid payroll period: missing start_date or end_date"
4. IF start_date is greater than end_date, THE Salary_Calculation_API SHALL return HTTP 400 with error message "Invalid payroll period: start_date must be before end_date"
5. THE Attendance_Service SHALL use the validated date range to filter Attendance_Records by check_in_time

### Requirement 10: Match Attendance Records to Payroll Period

**User Story:** As a payroll administrator, I want attendance records to be matched to the payroll period by check-in date, so that only relevant attendance is included in salary calculation.

#### Acceptance Criteria

1. THE Attendance_Service SHALL filter Attendance_Records WHERE DATE(check_in_time) >= Payroll_Period.start_date AND DATE(check_in_time) <= Payroll_Period.end_date
2. WHEN an Attendance_Record has check_in_time on the last day of the period and check_out_time on the next day, THE Attendance_Service SHALL include it in the period based on check_in_time date
3. THE Attendance_Service SHALL exclude Attendance_Records with null check_in_time from the date range filter
4. THE Attendance_Service SHALL use the database server's date extraction function to convert check_in_time timestamp to date for comparison

### Requirement 11: Aggregate Leave Days from Leave Records

**User Story:** As a payroll administrator, I want approved leave days to be counted separately from absent days, so that employees are not penalized for approved leaves.

#### Acceptance Criteria

1. THE Attendance_Service SHALL query approved Leave records for each employee within the Payroll_Period date range
2. THE Attendance_Service SHALL sum the number of leave days from approved Leave records to compute leave_days
3. THE Attendance_Service SHALL subtract leave_days from absent_days calculation: absent_days = working_days - present_days - leave_days
4. WHEN an employee has overlapping leave and attendance records on the same date, THE Attendance_Service SHALL prioritize the attendance record and not count it as leave
5. THE leave_days value SHALL be an integer greater than or equal to zero

### Requirement 12: Create Attendance Service Module

**User Story:** As a backend developer, I want a dedicated Attendance Service module to encapsulate attendance data aggregation logic, so that it can be reused across different features.

#### Acceptance Criteria

1. THE system SHALL create a new module at `backend/app/services/attendance_service.py`
2. THE Attendance_Service module SHALL export a function `get_employee_attendance_summary(db: AsyncSession, employee_id: str, start_date: date, end_date: date) -> dict`
3. THE function SHALL return a dictionary with keys: present_days, absent_days, leave_days, overtime_hours, total_days, working_days
4. THE Attendance_Service SHALL use SQLAlchemy async queries to fetch data from the attendance and leave tables
5. THE Attendance_Service SHALL handle database errors gracefully and log errors using Python's logging module

### Requirement 13: Update Salary Calculator to Use Attendance Service

**User Story:** As a backend developer, I want the Salary Calculator to call the Attendance Service instead of using hardcoded defaults, so that salary calculations use real data.

#### Acceptance Criteria

1. THE Salary_Calculator SHALL import the Attendance_Service module
2. WHEN `calculate_employee_salary` is called without attendance_data parameter, THE Salary_Calculator SHALL call `Attendance_Service.get_employee_attendance_summary` to fetch attendance data
3. WHEN `calculate_employee_salary` is called with attendance_data parameter, THE Salary_Calculator SHALL use the provided data without calling Attendance_Service (for backward compatibility)
4. THE Salary_Calculator SHALL pass the fetched attendance data to the existing salary computation logic
5. THE Salary_Calculator SHALL maintain the existing function signature to avoid breaking existing API contracts

### Requirement 14: Add Attendance Columns to Salary Calculation Response

**User Story:** As a frontend developer, I want the salary calculation API response to include attendance fields, so that I can display them in the UI without additional API calls.

#### Acceptance Criteria

1. THE SalaryCalculationResponse schema SHALL include fields: present_days (int), absent_days (int), leave_days (int), overtime_hours (Decimal)
2. THE `/v1/payroll/period/{period_id}` endpoint SHALL return these attendance fields for each employee in the response array
3. THE `/v1/payroll/employee/{employee_id}/period/{period_id}` endpoint SHALL return these attendance fields in the response object
4. THE attendance fields SHALL be populated from the SalaryCalculation database record
5. THE API response SHALL serialize Decimal fields to float with two decimal places for JSON compatibility

### Requirement 15: Update Admin Panel to Display Attendance Data

**User Story:** As a frontend developer, I want to update the Admin Panel salary calculation page to display attendance columns, so that administrators can see attendance summary.

#### Acceptance Criteria

1. THE Admin_Panel SalaryCalculation.jsx component SHALL add table columns for: Present Days, Absent Days, Leave Days, Overtime Hours
2. THE component SHALL display these values from the API response for each employee row
3. THE component SHALL display "0" for attendance fields when the value is null or undefined
4. THE component SHALL apply conditional styling: orange text for present_days=0, green text for present_days>0
5. THE table SHALL remain responsive and usable on screens with width >= 1366px

### Requirement 16: Add Warning Indicator for Zero Attendance

**User Story:** As a payroll administrator, I want a visual warning when an employee has zero attendance, so that I can quickly identify employees who may need follow-up.

#### Acceptance Criteria

1. WHEN present_days equals zero, THE Admin_Panel SHALL display a warning icon (⚠) next to the employee name
2. THE warning icon SHALL have an orange or amber color to indicate caution
3. THE warning icon SHALL have a tooltip or title attribute with text "No attendance records for this period"
4. THE warning SHALL be visible in both the salary calculation results table and the payslip preview
5. THE warning SHALL NOT prevent salary calculation approval or payslip generation

### Requirement 17: Handle Concurrent Salary Calculations

**User Story:** As a system administrator, I want the system to handle concurrent salary calculations for the same period safely, so that data integrity is maintained.

#### Acceptance Criteria

1. WHEN multiple salary calculations are triggered for the same Payroll_Period simultaneously, THE Salary_Calculator SHALL use database transactions to prevent race conditions
2. THE Salary_Calculator SHALL increment calculation_version for each recalculation of the same employee and period
3. THE Salary_Calculator SHALL mark previous calculations as CANCELLED when creating a new version
4. THE Attendance_Service SHALL use read-only queries that do not lock attendance records
5. THE system SHALL complete all concurrent calculations without deadlocks or data corruption

### Requirement 18: Log Attendance Data Fetch Operations

**User Story:** As a system administrator, I want attendance data fetch operations to be logged, so that I can troubleshoot issues and audit salary calculations.

#### Acceptance Criteria

1. THE Attendance_Service SHALL log an INFO message when fetching attendance data with format: "Fetching attendance for employee {employee_id} from {start_date} to {end_date}"
2. THE Attendance_Service SHALL log a WARNING message when an employee has zero attendance records with format: "No attendance records found for employee {employee_id} in period {period_id}"
3. THE Attendance_Service SHALL log an ERROR message when database queries fail with the exception details
4. THE Salary_Calculator SHALL log the attendance data received from Attendance_Service at DEBUG level
5. THE logs SHALL include timestamps and be written to the application log file configured in the backend settings

### Requirement 19: Optimize Attendance Query Performance

**User Story:** As a system administrator, I want attendance queries to be optimized for performance, so that salary calculation for large employee counts completes in reasonable time.

#### Acceptance Criteria

1. THE Attendance_Service SHALL use a single database query to fetch all attendance records for all employees in the payroll period (batch query)
2. THE Attendance_Service SHALL use database indexes on attendance.emp_id and attendance.date columns for efficient filtering
3. THE Attendance_Service SHALL aggregate attendance data in Python memory after fetching, rather than using multiple database queries per employee
4. WHEN calculating salary for 100 employees, THE system SHALL complete attendance data fetch in less than 5 seconds
5. THE Attendance_Service SHALL use SQLAlchemy query optimization techniques (selectinload, joinedload) to minimize database round trips

### Requirement 20: Validate Attendance Data Integrity

**User Story:** As a payroll administrator, I want the system to validate attendance data integrity before using it in salary calculation, so that invalid data does not cause incorrect salaries.

#### Acceptance Criteria

1. THE Attendance_Service SHALL validate that present_days is less than or equal to working_days
2. THE Attendance_Service SHALL validate that absent_days is less than or equal to working_days
3. THE Attendance_Service SHALL validate that present_days + absent_days + leave_days equals working_days (with tolerance for rounding)
4. IF validation fails, THE Attendance_Service SHALL log a WARNING and adjust values to maintain the equation: absent_days = working_days - present_days - leave_days
5. THE Attendance_Service SHALL validate that overtime_hours is greater than or equal to zero

### Requirement 21: Support Manual Attendance Override

**User Story:** As a payroll administrator, I want to manually override attendance data for specific employees when needed, so that I can correct errors or handle special cases.

#### Acceptance Criteria

1. THE Salary_Calculation_API SHALL accept an optional `attendance_overrides` parameter in the calculate salary request body
2. THE attendance_overrides parameter SHALL be a dictionary mapping employee_id to attendance data objects
3. WHEN an attendance override is provided for an employee, THE Salary_Calculator SHALL use the override data instead of calling Attendance_Service
4. THE Salary_Calculator SHALL log an INFO message when using manual override with format: "Using manual attendance override for employee {employee_id}"
5. THE manual override SHALL be stored in the SalaryCalculation.calculation_details JSON field for audit purposes

### Requirement 22: Add Attendance Summary to Payslip

**User Story:** As an employee, I want to see my attendance summary on my payslip, so that I understand how my salary was calculated.

#### Acceptance Criteria

1. THE payslip document SHALL include an "Attendance Summary" section with fields: Total Days, Working Days, Present Days, Absent Days, Leave Days, Overtime Hours
2. THE Attendance Summary section SHALL appear before the "Earnings" section on the payslip
3. THE payslip SHALL display LOP deduction in the "Deductions" section with calculation: "LOP: {absent_days} days × ₹{daily_rate} = ₹{lop_amount}"
4. THE payslip SHALL display overtime amount in the "Earnings" section with calculation: "Overtime: {overtime_hours} hours × ₹{hourly_rate} = ₹{overtime_amount}"
5. THE payslip SHALL format all numeric values with two decimal places and Indian number formatting (₹1,23,456.78)

### Requirement 23: Create Attendance Service Unit Tests

**User Story:** As a backend developer, I want comprehensive unit tests for the Attendance Service, so that attendance calculation logic is verified and regressions are prevented.

#### Acceptance Criteria

1. THE test suite SHALL include a test case for employees with full attendance (present all working days)
2. THE test suite SHALL include a test case for employees with zero attendance
3. THE test suite SHALL include a test case for employees with partial attendance and leaves
4. THE test suite SHALL include a test case for overtime calculation with various working hours
5. THE test suite SHALL include a test case for date range filtering to verify only records within the period are included
6. THE test suite SHALL use pytest and async test fixtures with an in-memory SQLite database
7. ALL test cases SHALL pass with 100% code coverage for the Attendance Service module

### Requirement 24: Create Integration Tests for Salary Calculation with Attendance

**User Story:** As a backend developer, I want integration tests that verify end-to-end salary calculation with real attendance data, so that the complete flow is validated.

#### Acceptance Criteria

1. THE test suite SHALL include an integration test that creates attendance records, triggers salary calculation, and verifies the SalaryCalculation record contains correct attendance values
2. THE test suite SHALL include an integration test for batch salary calculation with multiple employees having different attendance patterns
3. THE test suite SHALL include an integration test that verifies LOP deduction is correctly calculated based on absent days
4. THE test suite SHALL include an integration test that verifies overtime amount is correctly calculated based on overtime hours
5. THE integration tests SHALL use a test database with realistic sample data (at least 10 employees, 30 days of attendance)
6. ALL integration tests SHALL pass and complete in less than 30 seconds

### Requirement 25: Document Attendance Integration in API Documentation

**User Story:** As an API consumer, I want the attendance integration to be documented in the API documentation, so that I understand the new fields and behavior.

#### Acceptance Criteria

1. THE FastAPI automatic documentation (/docs) SHALL include updated schemas showing attendance fields in SalaryCalculationResponse
2. THE API documentation SHALL include a description of how attendance data is fetched and used in salary calculation
3. THE API documentation SHALL document the attendance_overrides parameter with example JSON
4. THE API documentation SHALL document the default attendance values used when no records exist
5. THE API documentation SHALL include example responses showing attendance fields populated with realistic values
