# 📋 Attendance Management System

A comprehensive web-based Attendance Management System with staff tracking, daily attendance entry, leave management with slab-based entitlements, and monthly summaries.

## 🚀 Features

### 👥 Staff Management
- Add, edit, and delete staff members
- Automatic slab calculation based on service duration
- Search and filter staff
- Department and role tracking

### 📅 Attendance Records
- **Daily Entry**: Log arrival and departure times for all staff
- **Auto-calculation**: Worked minutes computed automatically
- **Leave Tracking**: Mark leave with type (Annual, Sick, Pregnancy, Unpaid)
- **Monthly Summary**: View working days, required hours, total worked hours, shortage, and overtime

### 📊 Leave Summary
- Slab-based leave entitlements (3 slabs based on service period)
- Monthly breakdown with Total and Claimed columns for all 12 months
- Annual summary: Total Eligible, Total Leave, Claimed, Balance, Extra Bonus
- CSV export functionality
- Auto-deduction from leave balance

### 🎨 UI Features
- Dark maroon/burgundy professional theme
- Dark mode toggle
- Responsive design
- Toast notifications
- Modal forms

## 📋 Leave Policy

| Slab | Service Period | Annual | Sick | Pregnancy | Total |
|------|---------------|--------|------|-----------|-------|
| Slab 1 | < 12 months | 5 days | 2 days | 0 days | 7 days |
| Slab 2 | 12–30 months | 10 days | 4 days | 5 days | 19 days |
| Slab 3 | 30+ months | 12 days | 6 days | 10 days | 28 days |

## 🛠️ Tech Stack
- **HTML5** / **CSS3** / **Vanilla JavaScript**
- **localStorage** for data persistence
- No external frameworks — fully self-contained

## 📦 Usage
Simply open `index.html` in a browser, or visit the [live demo](https://your-username.github.io/attendance-management-system/).

## 📄 License
© 2027 — All Rights Reserved.
