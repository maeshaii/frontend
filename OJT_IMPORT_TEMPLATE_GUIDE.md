# OJT Import Template Guide

This guide explains all the fields in the OJT import template and how to use them.

## 🎯 Quick Start: Which Template Should I Use?

| Scenario | Template to Use | What to Fill |
|----------|----------------|--------------|
| **Creating NEW students** | 📥 First Import Template | ALL 16 required fields (personal + company info) |
| **Updating EXISTING students** | 🔄 Update Template | CTU_ID + only fields you want to change |
| **Adding company info to students** | 🔄 Update Template | CTU_ID + company fields |
| **Changing student contact info** | 🔄 Update Template | CTU_ID + contact fields |

---

## Template Fields

### ✅ REQUIRED Fields - Personal Information
These fields are **required** when creating new OJT students:

| Field | Description | Example | Notes |
|-------|-------------|---------|-------|
| `CTU_ID` | Student ID number | `1334330` | **Always required**. Must be unique. |
| `FirstName` | Student's first name | `Juan` | **Required** for new students |
| `MiddleName` | Student's middle name | `Dela` | **Required** for new students |
| `LastName` | Student's last name | `Cruz` | **Required** for new students |
| `Gender` | Student's gender | `Male` or `Female` | **Required**. Use: Male, Female, M, or F |
| `Birthdate` | Date of birth | `2000-01-15` | **Required**. Format: YYYY-MM-DD |
| `ContactNo` | Phone number | `09123456789` | **Required**. Student's contact number |
| `Email` | Email address | `juan.cruz@email.com` | **Required**. Student's email |
| `Address` | Home address | `Cebu City` | **Required**. Student's address |
| `Section` | Class section | `4-A` | **Required**. Student's section |

### ✅ REQUIRED Fields - Company Information
These fields are **required** for complete OJT setup:

| Field | Description | Example | Notes |
|-------|-------------|---------|-------|
| `CompanyName` | Company name | `Tech Company Inc` | **Required**. Where the student is doing OJT |
| `CompanyAddress` | Company location | `123 Business St, Cebu` | **Required**. Full company address |
| `CompanyEmail` | Company email | `hr@techcompany.com` | **Required**. Company contact email |
| `CompanyContact` | Company phone | `032-1234567` | **Required**. Company phone number |
| `ContactPerson` | Contact person name | `Maria Santos` | **Required**. Name of supervisor/contact |
| `Position` | Contact person position | `HR Manager` | **Required**. Contact person's job title |

### 📝 OPTIONAL Fields
These fields can be added later:

| Field | Description | Example | Notes |
|-------|-------------|---------|-------|
| `Status` | OJT status | `Ongoing` | Options: Ongoing, Completed, Not Started |

## Complete Import Process

### ✅ Single Complete Import (Recommended)
**Required fields:** ALL personal info + ALL company info fields

**Purpose:** Create fully-configured OJT students with all information in one step

**Example:**
```csv
CTU_ID,FirstName,MiddleName,LastName,Gender,Birthdate,ContactNo,Email,Address,Section,CompanyName,CompanyAddress,CompanyEmail,CompanyContact,ContactPerson,Position,Status
1334330,Nicole,Marie,Santos,Female,2000-05-15,09123456789,nicole@email.com,Cebu City,4-A,Tech Company Inc,Cebu IT Park,hr@techcorp.com,032-1234567,Maria Santos,HR Manager,Ongoing
1334331,Kevin,James,Uy,Male,2001-03-20,09198765432,kevin@email.com,Mandaue,4-A,Software Inc,Mandaue City,contact@software.com,032-9876543,John Doe,Supervisor,Ongoing
```

**Result:** 
- Students are created with generated passwords
- Password file is automatically downloaded
- All personal information is saved
- All company information is saved
- Ready to start OJT immediately

**Important:** ALL personal AND company fields must be filled. Missing any required field will skip that row.

### 🔄 Update Import (Existing Students)
**Required field:** `CTU_ID` only (to identify existing students)

**Purpose:** Update information for students who already exist

**Example:**
```csv
CTU_ID,Company_Email,Company_Contact,Status
1334330,newemail@company.com,032-9999999,Completed
```

**Result:**
- Existing students are updated with new information
- Only provided fields are updated
- No new passwords generated (students keep existing passwords)

## Import Modes

### 🆕 Create New Students
**When:** Students don't exist in database  
**Action:** Creates new user accounts with complete information  
**Required:** CTU_ID + ALL Personal Info Fields + ALL Company Info Fields  
**Output:** Password file with login credentials

**Required Fields:**
- Personal: CTU_ID, FirstName, MiddleName, LastName, Gender, Birthdate, ContactNo, Email, Address, Section
- Company: CompanyName, CompanyAddress, CompanyEmail, CompanyContact, ContactPerson, Position

### 🔄 Update Existing Students
**When:** Students already exist (matched by CTU_ID)  
**Action:** Updates existing records  
**Required:** CTU_ID only (other fields optional)  
**Output:** No password file (passwords unchanged)

**What can be updated:**
- Any personal information fields
- Any company information fields
- OJT dates and status

## Field Format Guidelines

### Gender Field
Accepted values:
- `Male` or `M`
- `Female` or `F`

### Birthdate Field
Format: `YYYY-MM-DD`
- ✅ Correct: `2000-01-15`
- ❌ Wrong: `01/15/2000`, `15-01-2000`

### Status Field
Accepted values:
- `Ongoing` - Student is currently doing OJT
- `Completed` - Student finished OJT
- `Not Started` - Student hasn't started yet

### Phone Numbers
Any format is accepted:
- `09123456789`
- `0912-345-6789`
- `+63 912 345 6789`

## Common Scenarios

### Scenario 1: Complete Student Import (New Students)
```csv
CTU_ID,FirstName,MiddleName,LastName,Gender,Birthdate,ContactNo,Email,Address,Section,CompanyName,CompanyAddress,CompanyEmail,CompanyContact,ContactPerson,Position
1334330,Nicole,Marie,Santos,Female,2000-05-15,09123456789,nicole@email.com,Cebu City,4-A,Tech Corp,Cebu IT Park,hr@techcorp.com,032-1234567,Maria Santos,HR Manager
1334331,Kevin,James,Uy,Male,2001-03-20,09198765432,kevin@email.com,Mandaue,4-A,Software Inc,Mandaue City,contact@software.com,032-9876543,John Doe,Supervisor
```
✅ All required fields present, students created with passwords, fully configured

### Scenario 2: Update Student Contact Information
```csv
CTU_ID,ContactNo,Email,Address
1334330,09999999999,new.email@email.com,New Address
```
✅ Updates only specified fields for existing students

### Scenario 3: Update Company Assignment
```csv
CTU_ID,CompanyName,CompanyAddress,CompanyEmail
1334330,New Company Ltd,456 Tech Ave,hr@newcompany.com
```
✅ Company info updated for existing student

### Scenario 4: Update OJT Status
```csv
CTU_ID,Status
1334330,Completed
1334331,Ongoing
```
✅ OJT status updated

## Tips & Best Practices

1. **✅ Complete Information**: Gather ALL student AND company information before importing
2. **✅ Use Excel**: Easier to manage data in Excel, then save as CSV
3. **✅ Check CTU_IDs**: Make sure they're unique and correct
4. **✅ Section Auto-Detection**: If Excel has multiple sections, system detects them automatically
5. **✅ Batch Import**: You can import multiple sections at once
6. **✅ Password Security**: First import generates secure random passwords
7. **✅ Company Contact**: Get complete company details including contact person before importing

8. **⚠️ Avoid Duplicates**: Don't import same student twice (use update import to modify)
9. **⚠️ Gender Values**: Must be Male/Female/M/F (case insensitive)
10. **⚠️ Birthdate Format**: Use YYYY-MM-DD format (e.g., 2000-01-15)
11. **⚠️ All Fields Required**: Missing ANY required field will skip that student

## Error Prevention

### ❌ Common Errors:

1. **Missing Required Fields**
   - Error: "New user requires - FirstName, MiddleName, LastName, Gender, Birthdate, ContactNo, Email, Address, Section, CompanyName, CompanyAddress, CompanyEmail, CompanyContact, ContactPerson, Position"
   - Fix: ALL personal AND company information fields are required for new students. Make sure every field is filled in.

2. **Invalid Gender**
   - Error: "Gender must be M/Male or F/Female"
   - Fix: Use only Male, Female, M, or F

3. **Invalid Birthdate Format**
   - Error: "Invalid birthdate format. Use YYYY-MM-DD format."
   - Fix: Use YYYY-MM-DD format (e.g., 2000-01-15)

4. **Invalid Birthdate Range**
   - Error: "Invalid birthdate. Must be a valid date between 1900-2020."
   - Fix: Birthdate must be realistic (1900-2020 range for students)

5. **Duplicate CTU_ID**
   - Result: Update existing student instead of creating new
   - Fix: Check if student already exists before importing

## Download Templates

There are **TWO different templates** available in the coordinator dashboard:

### 📥 First Import Template
**Button:** "📥 First Import Template"  
**File Name:** `ojt_first_import_template.csv`

**Use this when:** Creating NEW OJT students who don't exist in the system

**Includes 17 fields:**
- ✅ All personal information fields (10 fields)
- ✅ All company information fields (6 fields)
- ✅ Status field (1 field - optional)

**Requirements:**
- ALL personal info fields MUST be filled
- ALL company info fields MUST be filled
- No sample data included - fill in your own

### 🔄 Update Template
**Button:** "🔄 Update Template"  
**File Name:** `ojt_update_template.csv`

**Use this when:** Updating EXISTING students who are already in the system

**Includes 14 fields:**
- CTU_ID (required to identify student)
- Optional fields to update (name, contact, company info, etc.)

**Requirements:**
- Only CTU_ID is required
- Fill in ONLY the fields you want to update
- Leave other fields empty if no changes needed

## Support

For issues or questions:
- Check the console logs for detailed error messages
- Verify your Excel/CSV format matches the template
- Ensure all required fields are present for new students

