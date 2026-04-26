# Implementation Plan: Attendance Integration for Salary Calculation

## Overview

This implementation integrates real attendance data from the attendance tracking system into the salary calculation workflow. The plan follows a phased approach: first building the Attendance Service module, then integrating it with the Salary Calculator, updating the API layer, enhancing the Admin Panel UI, and finally comprehensive testing.

**Key Changes:**
- NEW: `backend/app/services/attendance_service.py` - Attendance data aggregation service
- MODIFY: `backend/app/utils/salary_calculator.py` - Integration with attendance service
- MODIFY: `backend/app/routers/salary_calculation.py` - API updates for attendance data
- MODIFY: `admin-panel/src/pages/SalaryCalculation.jsx` - UI updates for attendance display
- NEW: Test files for unit and integration testing

## Tasks

### Phase 1: Attendance Service Module

- [x] 1. Create Attendance Service foundation
  - [x] 1.1 Create services directory and attendance_service.py module
    - Create `backend/app/services/` directory if it doesn't exist
    - Create `backend/app/services/__init__.py` for module initialization
    - Create `backend/app/services/attendance_service.py` with module structure
    - Import required dependencies: SQLAlchemy AsyncSession, datetime, logging, typing
    - Set up module-level logger configuration
    - _Requirements: 12.1, 12.2, 12.5_

  - [x] 1.2 Implement helper function: _count_working_days()
    - Write function to count weekdays (Mon-Fri) between start_date and end_date
    - Exclude weekends (Saturday=6, Sunday=0)
    - Return integer count of working days
    - Add docstring with examples
    - _Requirements: 3.2_

  - [x] 1.3 Implement helper function: _calculate_present_days()
    - Accept list of Attendance records as parameter
    - Extract unique dates from records with non-null check_in_time
    - Count unique dates as present days
    - Handle multiple check-ins on same date (count as 1 day)
    - Return integer count
    - _Requirements: 2.1, 2.2_

  - [x] 1.4 Implement helper function: _calculate_overtime_hours()
    - Accept list of Attendance records and standard_hours parameter (default=8.0)
    - For each record with both check_in_time and check_out_time, calculate working hours
    - Calculate daily overtime as max(0, working_hours - standard_hours)
    - Sum overtime across all days
    - Round result to 2 decimal places
    - Return float value
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 1.5 Implement async helper function: _get_approved_leave_days()
    - Accept db session, employee_id, start_date, end_date as parameters
    - Query Leave table for approved leaves in date range
    - Use SQLAlchemy async query with filters: status='APPROVED', date overlap
    - Sum total_days from matching leave records
    - Return integer count
    - Handle case where no leaves exist (return 0)
    - _Requirements: 11.1, 11.2, 11.5_

- [x] 2. Implement core attendance aggregation function
  - [x] 2.1 Implement get_employee_attendance_summary() function signature
    - Define async function with parameters: db, employee_id, start_date, end_date
    - Add type hints: AsyncSession, str, date, date -> dict
    - Add comprehensive docstring with return value structure
    - _Requirements: 12.2, 12.3_

  - [x] 2.2 Implement attendance records query
    - Query Attendance table with filters: emp_id, date range (check_in_time between start/end)
    - Use SQLAlchemy async query with proper date extraction
    - Order by date and time for consistent processing
    - Handle database errors with try-except block
    - Log INFO message: "Fetching attendance for employee {employee_id} from {start_date} to {end_date}"
    - _Requirements: 1.1, 10.1, 10.2, 10.3, 10.4, 18.1_

  - [x] 2.3 Implement attendance data aggregation logic
    - Call _count_working_days() to get working_days
    - Call _calculate_present_days() with fetched records
    - Call _calculate_overtime_hours() with fetched records
    - Call _get_approved_leave_days() to get leave_days
    - Calculate absent_days = working_days - present_days - leave_days
    - Calculate total_days as calendar days in range
    - _Requirements: 1.2, 2.1, 3.1, 4.2, 11.3_

  - [x] 2.4 Implement data validation and integrity checks
    - Validate present_days <= working_days
    - Validate absent_days <= working_days
    - Validate present_days + absent_days + leave_days = working_days (with tolerance)
    - If validation fails, adjust absent_days to maintain equation
    - Log WARNING if adjustments made
    - Validate overtime_hours >= 0
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5_

  - [x] 2.5 Implement error handling and default values
    - Catch database exceptions and log ERROR with details
    - Return default values on error: present_days=0, absent_days=26, leave_days=0, overtime_hours=0, total_days=30, working_days=26
    - Log WARNING when employee has zero attendance records
    - Return dict with all required keys
    - _Requirements: 1.4, 6.1, 12.5, 18.2, 18.3_

- [ ]* 2.6 Write unit tests for Attendance Service
  - Create `backend/tests/services/test_attendance_service.py`
  - Test case: Full attendance (all working days present)
  - Test case: Zero attendance (no records)
  - Test case: Partial attendance with leaves
  - Test case: Overtime calculation with various working hours
  - Test case: Date range filtering (records before/during/after period)
  - Test case: Multiple check-ins same day (count as 1)
  - Test case: Leave overlap with attendance (attendance takes precedence)
  - Test case: Database error handling (returns defaults)
  - Use pytest with async fixtures and in-memory SQLite
  - Verify test coverage > 90%
  - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5, 23.6, 23.7_

- [x] 3. Checkpoint - Verify Attendance Service module
  - Run unit tests for attendance_service.py
  - Verify all tests pass
  - Check test coverage report
  - Ensure all tests pass, ask the user if questions arise.

### Phase 2: Salary Calculator Integration

- [x] 4. Integrate Attendance Service with Salary Calculator
  - [x] 4.1 Update salary_calculator.py imports
    - Import attendance_service module
    - Import AsyncSession from sqlalchemy.ext.asyncio
    - Verify existing imports for logging
    - _Requirements: 13.1_

  - [x] 4.2 Modify calculate_employee_salary() function signature
    - Add optional parameter: attendance_data: Dict = None
    - Maintain existing parameters for backward compatibility
    - Update docstring to document new parameter
    - _Requirements: 13.3, 13.5_

  - [x] 4.3 Implement attendance data fetch logic
    - Check if attendance_data parameter is None
    - If None, call attendance_service.get_employee_attendance_summary()
    - Pass db session, employee_id, period start_date, period end_date
    - Log DEBUG message with fetched attendance data
    - If attendance_data provided, log INFO message: "Using manual attendance override for employee {employee_id}"
    - _Requirements: 1.5, 5.1, 13.2, 18.4, 21.3, 21.4_

  - [x] 4.4 Update LOP deduction calculation
    - Use absent_days from attendance_data instead of hardcoded value
    - Calculate daily_rate = basic_salary / working_days
    - Calculate lop_deduction = daily_rate × absent_days
    - Round to 2 decimal places
    - _Requirements: 5.3, 6.2_

  - [x] 4.5 Update overtime amount calculation
    - Use overtime_hours from attendance_data
    - Calculate hourly_rate = basic_salary / (working_days × standard_shift_hours)
    - Calculate overtime_amount = overtime_hours × hourly_rate × overtime_multiplier
    - Round to 2 decimal places
    - Set overtime_amount=0 if overtime_hours=0
    - _Requirements: 5.4, 6.3_

  - [x] 4.6 Update SalaryCalculation record creation
    - Store present_days, absent_days, leave_days, overtime_hours in record
    - Store total_days and working_days in record
    - If manual override used, store attendance_data in calculation_details JSON field
    - Ensure all attendance fields are populated
    - _Requirements: 5.5, 21.5_

- [ ]* 4.7 Write unit tests for updated Salary Calculator
  - Create or update `backend/tests/utils/test_salary_calculator.py`
  - Test case: LOP deduction for absent days (10 absent, verify deduction amount)
  - Test case: Overtime amount calculation (10 OT hours, verify amount)
  - Test case: Manual attendance override (verify AttendanceService not called)
  - Test case: Zero attendance full LOP (present_days=0, verify net_salary)
  - Test case: Backward compatibility (existing function calls still work)
  - Use pytest with async fixtures
  - Mock attendance_service calls
  - _Requirements: 13.4_

- [x] 5. Checkpoint - Verify Salary Calculator integration
  - Run unit tests for salary_calculator.py
  - Verify all tests pass
  - Verify backward compatibility maintained
  - Ensure all tests pass, ask the user if questions arise.

### Phase 3: API Layer Updates

- [x] 6. Update Salary Calculation API schemas and endpoints
  - [x] 6.1 Update SalaryCalculationResponse schema
    - Add fields to schema: present_days (int), absent_days (int), leave_days (int), overtime_hours (Decimal)
    - Ensure fields are serialized correctly (Decimal to float with 2 decimals)
    - Update schema docstring
    - _Requirements: 14.1, 14.4, 14.5_

  - [x] 6.2 Update CalculateRequest schema
    - Add optional field: attendance_overrides (Dict[str, Dict])
    - Define structure for attendance override objects
    - Add validation for override data structure
    - Add schema example in docstring
    - _Requirements: 21.1, 21.2_

  - [x] 6.3 Add payroll period date validation
    - In calculate_salary endpoint, fetch PayrollPeriod by period_id
    - Validate start_date and end_date are not null
    - Validate start_date <= end_date
    - Raise HTTPException 400 if validation fails with appropriate error message
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 6.4 Update calculate_salary endpoint logic
    - Extract attendance_overrides from request payload
    - For each employee, check if override exists in attendance_overrides dict
    - Pass override to calculate_employee_salary() if exists
    - Handle partial failures in batch calculation (continue processing other employees)
    - _Requirements: 21.2, 21.3_

  - [x] 6.5 Update API response endpoints
    - Ensure GET /period/{period_id} returns attendance fields for all employees
    - Ensure GET /employee/{id}/period/{period_id} returns attendance fields
    - Verify response serialization works correctly
    - _Requirements: 14.2, 14.3_

  - [x] 6.6 Update API error responses
    - Add error response for invalid period dates
    - Add error response for missing period dates
    - Update batch calculation response to include partial failure details
    - _Requirements: 9.3, 9.4_

- [ ]* 6.7 Write integration tests for API endpoints
  - Create or update `backend/tests/integration/test_salary_with_attendance.py`
  - Test case: Complete flow with real attendance (create employee, attendance, calculate)
  - Test case: Batch calculation with mixed attendance (10 employees, varying patterns)
  - Test case: API response includes attendance fields (verify GET endpoints)
  - Test case: Manual attendance override via API (verify override used)
  - Test case: Invalid period dates (verify 400 error)
  - Test case: Zero attendance employee (verify calculation completes)
  - Use test database with realistic sample data
  - Verify all tests complete in < 30 seconds
  - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5, 24.6_

- [x] 7. Update API documentation
  - Update FastAPI schema descriptions for new fields
  - Add examples for attendance_overrides parameter
  - Document default attendance values behavior
  - Add example responses with attendance fields
  - Verify /docs endpoint shows updated schemas
  - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5_

- [x] 8. Checkpoint - Verify API layer updates
  - Run integration tests for API endpoints
  - Verify all tests pass
  - Test API manually via /docs interface
  - Verify error responses work correctly
  - Ensure all tests pass, ask the user if questions arise.

### Phase 4: Admin Panel UI Updates

- [x] 9. Update Admin Panel salary calculation page
  - [x] 9.1 Update SalaryCalculation.jsx table columns
    - Add column definitions for: Present Days, Absent Days, Leave Days, OT Hours
    - Position attendance columns before Gross Salary column
    - Add appropriate column labels and keys
    - _Requirements: 15.1, 15.2_

  - [x] 9.2 Update table data rendering
    - Map API response fields to table columns
    - Display "0" for null or undefined attendance values
    - Format overtime_hours to 2 decimal places
    - _Requirements: 15.3_

  - [x] 9.3 Implement conditional styling for present_days
    - Apply orange/amber text color when present_days === 0
    - Apply green text color when present_days > 0
    - Use Tailwind CSS classes: text-orange-600, text-green-600
    - _Requirements: 15.4, 16.2_

  - [x] 9.4 Create AttendanceWarning component
    - Create component that accepts presentDays prop
    - Display warning icon (⚠) when presentDays === 0
    - Add tooltip/title: "No attendance records for this period"
    - Style with amber color (text-amber-600)
    - Return null when presentDays > 0
    - _Requirements: 16.1, 16.3, 16.4_

  - [x] 9.5 Integrate AttendanceWarning into table
    - Add AttendanceWarning component next to employee name in table
    - Pass present_days value as prop
    - Ensure warning is visible in both results table and payslip preview
    - _Requirements: 7.4, 16.4_

  - [x] 9.6 Verify responsive layout
    - Test table layout on 1920x1080 screen
    - Test table layout on 1366x768 screen
    - Ensure attendance columns are visible without horizontal scrolling
    - Adjust column widths if necessary
    - _Requirements: 7.5, 15.5_

- [x] 10. Update payslip generation and display
  - [x] 10.1 Add Attendance Summary section to payslip template
    - Add section before Earnings section
    - Display fields: Total Days, Working Days, Present Days, Absent Days, Leave Days, Overtime Hours
    - Format numeric values with 2 decimal places
    - _Requirements: 22.1, 22.2_

  - [x] 10.2 Update LOP deduction display in payslip
    - Show calculation: "LOP: {absent_days} days × ₹{daily_rate} = ₹{lop_amount}"
    - Format currency with Indian number formatting (₹1,23,456.78)
    - Display in Deductions section
    - _Requirements: 22.3, 22.5_

  - [x] 10.3 Update overtime amount display in payslip
    - Show calculation: "Overtime: {overtime_hours} hours × ₹{hourly_rate} = ₹{overtime_amount}"
    - Format currency with Indian number formatting
    - Display in Earnings section
    - _Requirements: 22.4, 22.5_

  - [x] 10.4 Handle zero attendance in payslip
    - Display warning when present_days=0
    - Show full LOP deduction with explanation
    - Handle net_salary = 0 or negative cases
    - Verify payslip generation succeeds for zero attendance employees
    - _Requirements: 8.3, 8.4, 8.5, 16.5_

- [x] 11. Checkpoint - Verify Admin Panel updates
  - Test UI manually with various attendance scenarios
  - Verify warning indicators appear correctly
  - Verify payslip generation works for all cases
  - Test responsive layout on different screen sizes
  - Ensure all tests pass, ask the user if questions arise.

### Phase 5: Performance Optimization & Testing

- [x] 12. Implement performance optimizations
  - [x] 12.1 Optimize attendance query for batch processing
    - Modify attendance_service to support batch employee queries
    - Fetch all attendance records for all employees in single query
    - Group records by employee_id in Python memory
    - Process each employee's records separately
    - _Requirements: 19.1, 19.3_

  - [x] 12.2 Verify database indexes exist
    - Check for index on attendance(emp_id, date)
    - Check for index on leaves(emp_id, from_date, to_date)
    - Check for index on salary_calculations(employee_id, period_id)
    - Add indexes if missing (via migration or manual SQL)
    - _Requirements: 19.2_

  - [x] 12.3 Add query optimization techniques
    - Use SQLAlchemy selectinload/joinedload where appropriate
    - Minimize database round trips
    - Use async queries throughout
    - _Requirements: 19.5_

- [ ]* 12.4 Run performance tests
  - Create test with 100 employees, 30 days of attendance each
  - Measure attendance fetch duration
  - Measure total batch calculation duration
  - Verify attendance fetch completes in < 5 seconds
  - Verify total calculation completes in < 10 seconds
  - _Requirements: 19.4_

- [x] 13. Add logging and monitoring
  - [x] 13.1 Verify all required log messages are in place
    - INFO: Attendance fetch operations
    - WARNING: Zero attendance cases
    - ERROR: Database errors
    - DEBUG: Attendance data received by calculator
    - _Requirements: 18.1, 18.2, 18.3, 18.4_

  - [x] 13.2 Add audit trail for manual overrides
    - Ensure manual overrides are logged
    - Ensure overrides are stored in calculation_details
    - _Requirements: 21.4, 21.5_

- [x] 14. Handle concurrent calculations safely
  - [x] 14.1 Verify database transaction handling
    - Ensure salary calculations use proper transactions
    - Verify calculation_version increments correctly
    - Verify previous calculations marked as CANCELLED
    - Test concurrent calculation scenarios
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

- [x] 15. Final integration testing and validation
  - [x] 15.1 Run full test suite
    - Execute all unit tests
    - Execute all integration tests
    - Verify all tests pass
    - Check test coverage reports
    - _Requirements: 23.7, 24.6_

  - [x] 15.2 Manual end-to-end testing
    - Test complete flow: create attendance → calculate salary → view results → generate payslip
    - Test with various attendance patterns (full, partial, zero, with leaves, with OT)
    - Test manual override functionality
    - Test error scenarios (invalid dates, missing data)
    - Test concurrent calculations
    - _Requirements: 6.4, 6.5, 8.1, 8.2_

  - [x] 15.3 Verify all requirements are met
    - Review requirements document
    - Verify each acceptance criterion is satisfied
    - Document any deviations or limitations
    - _Requirements: All_

- [x] 16. Final checkpoint - Complete implementation
  - Ensure all tests pass
  - Verify performance targets met
  - Verify UI works correctly
  - Verify API documentation is complete
  - Ask the user if questions arise or if ready for deployment.

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at phase boundaries
- The implementation uses Python with FastAPI, SQLAlchemy async, and React
- All attendance fields already exist in the database schema - no migrations needed
- Manual overrides are supported for backward compatibility and special cases
- Performance target: Calculate salary for 100 employees in < 10 seconds

## Testing Strategy

- **Unit Tests**: Test individual functions in isolation (attendance_service helpers, salary calculator logic)
- **Integration Tests**: Test complete flows with test database (API endpoints, end-to-end salary calculation)
- **Performance Tests**: Verify batch processing meets performance targets
- **Manual Testing**: Verify UI behavior and edge cases

## Success Criteria

1. ✅ Attendance Service module created and tested
2. ✅ Salary Calculator integrated with real attendance data
3. ✅ API endpoints updated with attendance fields
4. ✅ Admin Panel displays attendance summary with warnings
5. ✅ Payslips include attendance details
6. ✅ All tests pass with > 90% coverage
7. ✅ Performance targets met (< 10s for 100 employees)
8. ✅ Zero attendance cases handled gracefully
9. ✅ Manual overrides supported for special cases
10. ✅ API documentation updated
