/**
 * Attendance Management System - Core Application Logic
 * Manages staff records, daily & monthly attendance tracking,
 * slab-based leave entitlements, CSV export, modals, toasts, and theme state.
 */

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const STORAGE_KEYS = {
    STAFFS: 'ams_staffs',
    ATTENDANCE: 'ams_attendance',
    LEAVE_RECORDS: 'ams_leave_records',
    THEME: 'ams_dark_mode'
};

const STANDARD_DAILY_HOURS = 8;
const DEFAULT_REF_YEAR = 2027;

const MONTH_NAMES = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const TAB_TITLES = {
    staffs: 'Staffs',
    attendance: 'Attendance Records',
    leave: 'Leave Summary'
};

const PRE_POPULATED_STAFF = [
   
{
    id: 'H5', name: 'MS. ZARA', department: 'General Management', role: 'GM', joinDate: '2022-09-01', gender: 'Female' },
    { id: 'H10', name: 'MR. AFHAR', department: 'Business Unit', role: 'Staff', joinDate: '2024-09-01', gender: 'Male' },
    { id: 'H13', name: 'MS. AMAANI', department: 'Administration Unit', role: 'Head of Administration', joinDate: '2024-09-01', gender: 'Female' },
    { id: 'H17', name: 'MS. SASNA', department: 'Business Unit', role: 'Unit Head', joinDate: '2024-10-01', gender: 'Female' },
    { id: 'H18', name: 'MS. ALIZA', department: 'Student Relationships & Assessment', role: 'Head of Quality', joinDate: '2024-10-01', gender: 'Female' },
    { id: 'H31', name: 'MS. AALIYA', department: 'Academic Unit', role: 'Head of Academic', joinDate: '2022-09-01', gender: 'Female' },
    { id: 'H44', name: 'MS. ANFA', department: 'Academic Unit', role: 'Staff', joinDate: '2025-07-01', gender: 'Female' },
    { id: 'H50', name: 'MS. AAMAARA', department: 'Student Relationships & Assessment', role: 'Staff', joinDate: '2025-08-01', gender: 'Female' },
    { id: 'H61', name: 'MS. AMAYA', department: 'Business Unit', role: 'Staff', joinDate: '2025-12-01', gender: 'Female' },
    { id: 'HL18', name: 'MR. N. HANAN', department: 'Business Unit', role: 'Staff', joinDate: '2025-03-01', gender: 'Male' },
    { id: 'H64', name: 'MS. USAIRIYA', department: 'Student Relationships & Assessment', role: 'Staff', joinDate: '2026-04-01', gender: 'Female' },
    { id: 'H65', name: 'MS. AZEEM', department: 'Administration Unit', role: 'Staff', joinDate: '2026-04-01', gender: 'Male' }    
];

// ============================================================================
// APPLICATION STATE
// ============================================================================

let staffs = [];
let attendanceData = {};
let leaveRecords = {};
let confirmAction = null;

// ============================================================================
// DATA LAYER
// ============================================================================

/**
 * Safely parse JSON from localStorage with a fallback value.
 * @param {string} key
 * @param {*} fallback
 * @returns {*}
 */
function readStorage(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        const parsed = JSON.parse(raw);
        return parsed !== null && parsed !== undefined ? parsed : fallback;
    } catch (err) {
        console.error(`Failed to parse localStorage key "${key}":`, err);
        return fallback;
    }
}

/**
 * Build initial pre-populated staff list with computed slabs.
 * @returns {Array<Object>}
 */
function buildDefaultStaffs() {
    return PRE_POPULATED_STAFF.map(member => ({
        ...member,
        slab: calculateSlab(member.joinDate, DEFAULT_REF_YEAR)
    }));
}

/**
 * Create an empty annual leave record structure for a single staff member.
 * @returns {Object}
 */
function createEmptyLeaveRecord() {
    const monthlyUsage = {};
    for (let m = 1; m <= 12; m++) {
        monthlyUsage[m] = {
            total: 0,
            annual: 0,
            sick: 0,
            pregnancy: 0,
            unpaid: 0,
            extraBonus: 0,
            claimed: 0
        };
    }

    return {
        annual: { used: 0 },
        sick: { used: 0 },
        pregnancy: { used: 0 },
        unpaid: { used: 0 },
        extraBonus: { total: 0, used: 0 },
        monthlyUsage
    };
}

/**
 * Ensure an existing leave record has every expected property and month bucket.
 * @param {Object} record
 * @returns {Object}
 */
function normalizeLeaveRecord(record) {
    const base = createEmptyLeaveRecord();
    if (!record || typeof record !== 'object') return base;

    base.annual.used = Number(record.annual?.used) || 0;
    base.sick.used = Number(record.sick?.used) || 0;
    base.pregnancy.used = Number(record.pregnancy?.used) || 0;
    base.unpaid.used = Number(record.unpaid?.used) || 0;
    base.extraBonus.total = Number(record.extraBonus?.total) || 0;
    base.extraBonus.used = Number(record.extraBonus?.used) || 0;

    for (let m = 1; m <= 12; m++) {
        const src = record.monthlyUsage?.[m];
        if (src && typeof src === 'object') {
            base.monthlyUsage[m] = {
                total: Number(src.total) || 0,
                annual: Number(src.annual) || 0,
                sick: Number(src.sick) || 0,
                pregnancy: Number(src.pregnancy) || 0,
                unpaid: Number(src.unpaid) || 0,
                extraBonus: Number(src.extraBonus) || 0,
                claimed: Number(src.claimed) || 0
            };
        }
    }

    return base;
}

/**
 * Load all stores from localStorage or initialize with defaults.
 */
function loadData() {
    const rawStaffs = localStorage.getItem(STORAGE_KEYS.STAFFS);
    if (rawStaffs === null) {
        staffs = buildDefaultStaffs();
    } else {
        const parsed = readStorage(STORAGE_KEYS.STAFFS, null);
        if (Array.isArray(parsed)) {
            staffs = parsed.map(member => ({
                ...member,
                slab: member.joinDate ? calculateSlab(member.joinDate, DEFAULT_REF_YEAR) : (member.slab || 1)
            }));
        } else {
            staffs = buildDefaultStaffs();
        }
    }

    const storedAttendance = readStorage(STORAGE_KEYS.ATTENDANCE, {});
    attendanceData = storedAttendance && typeof storedAttendance === 'object' && !Array.isArray(storedAttendance)
        ? storedAttendance
        : {};

    const storedLeave = readStorage(STORAGE_KEYS.LEAVE_RECORDS, {});
    leaveRecords = storedLeave && typeof storedLeave === 'object' && !Array.isArray(storedLeave)
        ? storedLeave
        : {};

    initLeaveRecords(DEFAULT_REF_YEAR);

    if (rawStaffs === null) {
        saveData();
    }
}

/**
 * Persist staffs, attendance, and leave records to localStorage.
 */
function saveData() {
    localStorage.setItem(STORAGE_KEYS.STAFFS, JSON.stringify(staffs));
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(attendanceData));
    localStorage.setItem(STORAGE_KEYS.LEAVE_RECORDS, JSON.stringify(leaveRecords));
}

/**
 * Calculate staff slab (1, 2, or 3) based on complete months from joinDate to Jan 1 of refYear.
 * Slab 1: < 12 months
 * Slab 2: 12 to < 30 months
 * Slab 3: >= 30 months
 * @param {string} joinDate - ISO date string (YYYY-MM-DD)
 * @param {number} [refYear=2027]
 * @returns {number}
 */
function calculateSlab(joinDate, refYear = DEFAULT_REF_YEAR) {
    if (!joinDate) return 1;
    const parts = String(joinDate).split('-').map(Number);
    if (parts.length !== 3 || parts.some(Number.isNaN)) return 1;

    const [joinYear, joinMonth, joinDay] = parts;
    // Month difference from joinDate to Jan 1 of refYear (month=1, day=1)
    let months = (refYear - joinYear) * 12 + (1 - joinMonth);
    if (1 < joinDay) {
        months -= 1;
    }

    if (months < 12) return 1;
    if (months < 30) return 2;
    return 3;
}

/**
 * Return leave entitlement breakdown for a given slab and gender.
 * Pregnancy leave applies only to Female staff in Slab 2 or Slab 3.
 * @param {number} slab
 * @param {string} gender
 * @returns {{annual: number, sick: number, pregnancy: number, total: number}}
 */
function getEntitlement(slab, gender) {
    const isFemale = String(gender || '').toLowerCase() === 'female';
    let annual = 5;
    let sick = 2;
    let pregnancy = 0;

    if (slab === 2) {
        annual = 10;
        sick = 4;
        pregnancy = isFemale ? 5 : 0;
    } else if (slab === 3) {
        annual = 12;
        sick = 6;
        pregnancy = isFemale ? 10 : 0;
    }

    return {
        annual,
        sick,
        pregnancy,
        total: annual + sick + pregnancy
    };
}

/**
 * Return maximum paid leave days allowed per month for a slab.
 * @param {number} slab
 * @returns {number}
 */
function getMonthlyLimit(slab) {
    if (slab === 1) return 1;
    if (slab === 2) return 5;
    return Infinity;
}

/**
 * Ensure leave records exist for all current staff for the given year.
 * @param {number|string} year
 */
function initLeaveRecords(year) {
    const yr = String(year || DEFAULT_REF_YEAR);
    if (!leaveRecords[yr] || typeof leaveRecords[yr] !== 'object') {
        leaveRecords[yr] = {};
    }

    staffs.forEach(staff => {
        leaveRecords[yr][staff.id] = normalizeLeaveRecord(leaveRecords[yr][staff.id]);
    });
}

// ============================================================================
// TAB NAVIGATION
// ============================================================================

/**
 * Switch active sidebar link, content panel, page title, and refresh tab view.
 * @param {string} tabName
 */
function switchTab(tabName) {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.tab === tabName);
    });

    document.querySelectorAll('.tab-content').forEach(section => {
        section.classList.toggle('active', section.id === `${tabName}-tab`);
    });

    const pageTitle = document.getElementById('page-title');
    if (pageTitle) {
        pageTitle.textContent = TAB_TITLES[tabName] || 'Attendance Manager';
    }

    if (tabName === 'staffs') {
        renderStaffs();
    } else if (tabName === 'attendance') {
        const monthlySection = document.getElementById('monthly-summary-section');
        if (monthlySection && monthlySection.style.display !== 'none') {
            renderMonthlySummary();
        } else {
            renderDailyAttendance();
        }
    } else if (tabName === 'leave') {
        renderLeaveSummary();
    }
}

// ============================================================================
// STAFF TAB
// ============================================================================

/**
 * Render staff directory table, stat cards, and sidebar badge with active search filter.
 */
function renderStaffs() {
    const tbody = document.getElementById('staffs-tbody');
    const searchInput = document.getElementById('staff-search');
    const query = (searchInput ? searchInput.value : '').trim().toLowerCase();

    // Update overall stat cards and sidebar badge across all staff
    const totalCount = staffs.length;
    const slabCounts = { 1: 0, 2: 0, 3: 0 };

    staffs.forEach(staff => {
        const slab = staff.slab || calculateSlab(staff.joinDate, DEFAULT_REF_YEAR);
        staff.slab = slab;
        if (slabCounts[slab] !== undefined) {
            slabCounts[slab] += 1;
        }
    });

    const totalEl = document.getElementById('total-staff-count');
    const slab1El = document.getElementById('slab1-count');
    const slab2El = document.getElementById('slab2-count');
    const slab3El = document.getElementById('slab3-count');
    const badgeEl = document.getElementById('staff-count-badge');

    if (totalEl) totalEl.textContent = totalCount;
    if (slab1El) slab1El.textContent = slabCounts[1];
    if (slab2El) slab2El.textContent = slabCounts[2];
    if (slab3El) slab3El.textContent = slabCounts[3];
    if (badgeEl) badgeEl.textContent = totalCount;

    populateLeaveStaffSelect();

    if (!tbody) return;

    const filtered = staffs
        .map((staff, index) => ({ staff, index }))
        .filter(({ staff }) => {
            if (!query) return true;
            return (
                staff.id.toLowerCase().includes(query) ||
                staff.name.toLowerCase().includes(query) ||
                staff.department.toLowerCase().includes(query) ||
                staff.role.toLowerCase().includes(query)
            );
        });

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    <i class="fa-solid fa-users-slash"></i>
                    ${query ? 'No staff members match your search.' : 'No staff members found. Click "Add Staff" to get started.'}
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(({ staff, index }, rowIdx) => `
        <tr>
            <td>${rowIdx + 1}</td>
            <td><strong>${escapeHtml(staff.id)}</strong></td>
            <td>${escapeHtml(staff.name)}</td>
            <td>${escapeHtml(staff.department)}</td>
            <td>${escapeHtml(staff.role)}</td>
            <td>${escapeHtml(formatDate(staff.joinDate))}</td>
            <td><span class="slab-badge slab-${staff.slab}">Slab ${staff.slab}</span></td>
            <td>
                <button type="button" class="btn btn-icon btn-sm edit-staff-btn" data-index="${index}" title="Edit Staff" aria-label="Edit ${escapeHtml(staff.name)}">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button type="button" class="btn btn-icon btn-sm delete-staff-btn" data-index="${index}" title="Delete Staff" aria-label="Delete ${escapeHtml(staff.name)}">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

/**
 * Open the Add/Edit Staff modal and populate or reset form fields.
 * @param {'add'|'edit'} mode
 * @param {number|null} [index=null]
 */
function openStaffModal(mode = 'add', index = null) {
    const modal = document.getElementById('staff-modal');
    const form = document.getElementById('staff-form');
    if (!modal || !form) return;

    const titleEl = modal.querySelector('.modal-header h3');
    const modeInput = document.getElementById('staff-form-mode');
    const editIndexInput = document.getElementById('staff-edit-index');
    const empIdInput = document.getElementById('staff-emp-id');
    const nameInput = document.getElementById('staff-name');
    const deptInput = document.getElementById('staff-department');
    const roleInput = document.getElementById('staff-role');
    const joinDateInput = document.getElementById('staff-join-date');
    const genderInput = document.getElementById('staff-gender');

    form.reset();

    if (mode === 'edit' && index !== null && staffs[index]) {
        const staff = staffs[index];
        if (titleEl) titleEl.textContent = 'Edit Staff';
        modeInput.value = 'edit';
        editIndexInput.value = String(index);
        empIdInput.value = staff.id;
        nameInput.value = staff.name;
        deptInput.value = staff.department;
        roleInput.value = staff.role;
        joinDateInput.value = staff.joinDate;
        genderInput.value = staff.gender || 'Male';
    } else {
        if (titleEl) titleEl.textContent = 'Add Staff';
        modeInput.value = 'add';
        editIndexInput.value = '';
        genderInput.value = 'Male';
    }

    openModal('staff-modal');
}

/**
 * Migrate attendance and leave record keys when a staff member's Emp ID changes.
 * @param {string} oldId
 * @param {string} newId
 */
function migrateStaffIdRecords(oldId, newId) {
    if (!oldId || !newId || oldId === newId) return;

    Object.keys(attendanceData).forEach(dateKey => {
        const dayEntries = attendanceData[dateKey];
        if (dayEntries && Object.prototype.hasOwnProperty.call(dayEntries, oldId)) {
            dayEntries[newId] = dayEntries[oldId];
            delete dayEntries[oldId];
        }
    });

    Object.keys(leaveRecords).forEach(yearKey => {
        const yearEntries = leaveRecords[yearKey];
        if (yearEntries && Object.prototype.hasOwnProperty.call(yearEntries, oldId)) {
            yearEntries[newId] = yearEntries[oldId];
            delete yearEntries[oldId];
        }
    });
}

/**
 * Validate and save a new or edited staff member.
 * @param {Event} [e]
 */
function saveStaff(e) {
    if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
    }

    const mode = document.getElementById('staff-form-mode').value;
    const editIndexRaw = document.getElementById('staff-edit-index').value;
    const editIndex = editIndexRaw !== '' ? parseInt(editIndexRaw, 10) : -1;

    const id = document.getElementById('staff-emp-id').value.trim();
    const name = document.getElementById('staff-name').value.trim();
    const department = document.getElementById('staff-department').value.trim();
    const role = document.getElementById('staff-role').value.trim();
    const joinDate = document.getElementById('staff-join-date').value;
    const gender = document.getElementById('staff-gender').value;

    if (!id || !name || !department || !role || !joinDate || !gender) {
        showToast('Please fill in all required staff fields.', 'error');
        return;
    }

    const duplicateIdx = staffs.findIndex(
        (member, idx) => member.id.toLowerCase() === id.toLowerCase() && (mode !== 'edit' || idx !== editIndex)
    );
    if (duplicateIdx !== -1) {
        showToast(`Employee ID "${id}" already exists.`, 'error');
        return;
    }

    const slab = calculateSlab(joinDate, DEFAULT_REF_YEAR);
    const staffRecord = { id, name, department, role, joinDate, gender, slab };

    if (mode === 'edit' && editIndex >= 0 && staffs[editIndex]) {
        const previousId = staffs[editIndex].id;
        staffs[editIndex] = staffRecord;
        if (previousId !== id) {
            migrateStaffIdRecords(previousId, id);
        }
        // Recalculate leave counts for existing leave years in case joinDate/gender changed
        Object.keys(leaveRecords).forEach(yr => recalculateLeaveFromAttendance(yr));
        showToast(`${name} updated successfully.`, 'success');
    } else {
        staffs.push(staffRecord);
        Object.keys(leaveRecords).forEach(yr => initLeaveRecords(yr));
        showToast(`${name} added successfully.`, 'success');
    }

    saveData();
    closeModal('staff-modal');
    renderStaffs();
}

/**
 * Prompt confirmation and delete a staff member by array index.
 * @param {number} index
 */
function deleteStaff(index) {
    const staff = staffs[index];
    if (!staff) return;

    const confirmMessage = document.getElementById('confirm-message');
    if (confirmMessage) {
        confirmMessage.textContent = `Are you sure you want to delete ${staff.name} (${staff.id})?`;
    }

    confirmAction = () => {
        staffs.splice(index, 1);
        saveData();
        renderStaffs();
        showToast(`${staff.name} deleted.`, 'success');
    };

    openModal('confirm-modal');
}

// ============================================================================
// ATTENDANCE TAB
// ============================================================================

/**
 * Compute worked minutes from HH:MM arrival and departure strings.
 * @param {string} arrivalTime
 * @param {string} departureTime
 * @returns {number}
 */
function computeWorkedMinutes(arrivalTime, departureTime) {
    if (!arrivalTime || !departureTime) return 0;
    const [arrHr, arrMin] = arrivalTime.split(':').map(Number);
    const [depHr, depMin] = departureTime.split(':').map(Number);
    if ([arrHr, arrMin, depHr, depMin].some(Number.isNaN)) return 0;
    return Math.max(0, (depHr * 60 + depMin) - (arrHr * 60 + arrMin));
}

/**
 * Map a leave type label to the leave record category key.
 * @param {string} leaveType
 * @returns {'annual'|'sick'|'pregnancy'|'unpaid'}
 */
function mapLeaveCategory(leaveType) {
    const normalized = String(leaveType || '').trim().toLowerCase();
    if (normalized.includes('annual')) return 'annual';
    if (normalized.includes('sick')) return 'sick';
    if (normalized.includes('pregnancy')) return 'pregnancy';
    return 'unpaid';
}

/**
 * Update a single daily attendance row's enabled/disabled inputs, leave select visibility, and worked min span.
 * @param {HTMLTableRowElement} row
 */
function syncDailyRowState(row) {
    const arrivalInput = row.querySelector('.att-arrival');
    const departureInput = row.querySelector('.att-departure');
    const statusSelect = row.querySelector('.att-status');
    const leaveTypeSelect = row.querySelector('.att-leave-type');
    const workedSpan = row.querySelector('.att-worked-min');

    if (!statusSelect || !arrivalInput || !departureInput || !leaveTypeSelect || !workedSpan) return;

    const isLeave = statusSelect.value === 'Leave';

    statusSelect.classList.toggle('status-leave', isLeave);
    statusSelect.classList.toggle('status-present', !isLeave);

    arrivalInput.disabled = isLeave;
    departureInput.disabled = isLeave;
    leaveTypeSelect.style.display = isLeave ? '' : 'none';

    if (isLeave) {
        workedSpan.textContent = '0 min';
    } else {
        const mins = computeWorkedMinutes(arrivalInput.value, departureInput.value);
        workedSpan.textContent = `${mins} min`;
    }
}

/**
 * Render daily attendance entry rows for the currently selected date.
 */
function renderDailyAttendance() {
    const dateInput = document.getElementById('attendance-date');
    const tbody = document.getElementById('attendance-daily-tbody');
    if (!dateInput || !tbody) return;

    const selectedDate = dateInput.value;
    const dayRecords = attendanceData[selectedDate] || {};

    if (staffs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <i class="fa-solid fa-calendar-xmark"></i>
                    No staff members available to log attendance.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = staffs.map(staff => {
        const record = dayRecords[staff.id] || {};
        const status = record.status === 'Leave' ? 'Leave' : 'Present';
        const arrival = record.arrivalTime || '';
        const departure = record.departureTime || '';
        const leaveType = record.leaveType || '';
        const workedMin = status === 'Present'
            ? (typeof record.workedMinutes === 'number' ? record.workedMinutes : computeWorkedMinutes(arrival, departure))
            : 0;

        return `
            <tr data-staff-id="${escapeHtml(staff.id)}">
                <td><strong>${escapeHtml(staff.id)}</strong></td>
                <td>${escapeHtml(staff.name)}</td>
                <td>
                    <input type="time" class="att-arrival" value="${escapeHtml(arrival)}" ${status === 'Leave' ? 'disabled' : ''}>
                </td>
                <td>
                    <input type="time" class="att-departure" value="${escapeHtml(departure)}" ${status === 'Leave' ? 'disabled' : ''}>
                </td>
                <td>
                    <select class="att-status ${status === 'Leave' ? 'status-leave' : 'status-present'}">
                        <option value="Present" ${status === 'Present' ? 'selected' : ''}>Present</option>
                        <option value="Leave" ${status === 'Leave' ? 'selected' : ''}>Leave</option>
                    </select>
                </td>
                <td>
                    <select class="att-leave-type" style="${status === 'Leave' ? '' : 'display: none;'}">
                        <option value="" ${leaveType === '' ? 'selected' : ''}>None</option>
                        <option value="Annual Paid" ${leaveType === 'Annual Paid' ? 'selected' : ''}>Annual Paid</option>
                        <option value="Sick" ${leaveType === 'Sick' || leaveType === 'Sick Paid' ? 'selected' : ''}>Sick</option>
                        <option value="Pregnancy" ${leaveType === 'Pregnancy' || leaveType === 'Pregnancy Paid' ? 'selected' : ''}>Pregnancy</option>
                        <option value="Unpaid" ${leaveType === 'Unpaid' ? 'selected' : ''}>Unpaid</option>
                    </select>
                </td>
                <td>
                    <span class="att-worked-min">${workedMin} min</span>
                </td>
            </tr>
        `;
    }).join('');

    // Attach listeners to each row for live status & worked-minutes reactivity
    tbody.querySelectorAll('tr[data-staff-id]').forEach(row => {
        const arrivalInput = row.querySelector('.att-arrival');
        const departureInput = row.querySelector('.att-departure');
        const statusSelect = row.querySelector('.att-status');

        if (statusSelect) {
            statusSelect.addEventListener('change', () => syncDailyRowState(row));
        }
        if (arrivalInput) {
            arrivalInput.addEventListener('input', () => syncDailyRowState(row));
            arrivalInput.addEventListener('change', () => syncDailyRowState(row));
        }
        if (departureInput) {
            departureInput.addEventListener('input', () => syncDailyRowState(row));
            departureInput.addEventListener('change', () => syncDailyRowState(row));
        }
    });
}

/**
 * Apply a single leave entry for a staff member against slab entitlement and monthly limit.
 * Reclassifies to Unpaid if ineligible or limit/balance exceeded.
 * @param {Object} staff
 * @param {number} year
 * @param {number} month - 1-indexed (1..12)
 * @param {string} leaveType
 * @returns {{finalLeaveType: string, warning: string|null}}
 */
function processLeaveForRecord(staff, year, month, leaveType) {
    const yr = String(year);
    initLeaveRecords(yr);

    const record = leaveRecords[yr][staff.id];
    const slab = staff.joinDate ? calculateSlab(staff.joinDate, Number(year)) : (staff.slab || 1);
    const entitlement = getEntitlement(slab, staff.gender);
    const monthlyLimit = getMonthlyLimit(slab);
    const monthBucket = record.monthlyUsage[month];

    const category = mapLeaveCategory(leaveType);

    if (category === 'unpaid') {
        record.unpaid.used += 1;
        monthBucket.unpaid += 1;
        monthBucket.total += 1;
        const warning = !leaveType || leaveType === 'None'
            ? `${staff.name}: No leave type selected — recorded as Unpaid.`
            : null;
        return { finalLeaveType: 'Unpaid', warning };
    }

    const categoryBalance = entitlement[category] - record[category].used;
    const withinMonthlyLimit = monthBucket.claimed < monthlyLimit;

    if (withinMonthlyLimit && categoryBalance > 0) {
        record[category].used += 1;
        monthBucket[category] += 1;
        monthBucket.claimed += 1;
        monthBucket.total += 1;
        return { finalLeaveType: leaveType, warning: null };
    }

    // Check if Extra Bonus balance can cover annual or sick leave when regular quota is depleted
    const bonusRemaining = record.extraBonus.total - record.extraBonus.used;
    if (withinMonthlyLimit && (category === 'annual' || category === 'sick') && bonusRemaining > 0) {
        record.extraBonus.used += 1;
        monthBucket.extraBonus += 1;
        monthBucket.claimed += 1;
        monthBucket.total += 1;
        return { finalLeaveType: leaveType, warning: null };
    }

    // Exceeded monthly cap, category balance, or ineligible for pregnancy -> auto-reclassify to Unpaid
    record.unpaid.used += 1;
    monthBucket.unpaid += 1;
    monthBucket.total += 1;

    let reason = 'leave balance exhausted';
    if (category === 'pregnancy' && entitlement.pregnancy === 0) {
        reason = slab === 1 ? 'Slab 1 not eligible for Pregnancy leave' : 'Pregnancy leave is for female staff only';
    } else if (!withinMonthlyLimit) {
        reason = `monthly limit (${monthlyLimit}) reached`;
    } else if (categoryBalance <= 0) {
        reason = `${leaveType} balance exhausted`;
    }

    return {
        finalLeaveType: 'Unpaid',
        warning: `${staff.name}: ${reason} — reclassified as Unpaid.`
    };
}

/**
 * Save daily attendance for all staff rows on the selected date and update leave records.
 */
function saveAttendance() {
    const dateInput = document.getElementById('attendance-date');
    const tbody = document.getElementById('attendance-daily-tbody');
    if (!dateInput || !tbody) return;

    const selectedDate = dateInput.value;
    if (!selectedDate) {
        showToast('Please select an attendance date.', 'error');
        return;
    }

    if (staffs.length === 0) {
        showToast('No staff records to save.', 'warning');
        return;
    }

    const [yearStr] = selectedDate.split('-');
    const year = parseInt(yearStr, 10);

    if (!attendanceData[selectedDate]) {
        attendanceData[selectedDate] = {};
    }

    const rows = tbody.querySelectorAll('tr[data-staff-id]');
    rows.forEach(row => {
        const staffId = row.dataset.staffId;
        const arrivalTime = row.querySelector('.att-arrival')?.value || '';
        const departureTime = row.querySelector('.att-departure')?.value || '';
        const status = row.querySelector('.att-status')?.value || 'Present';
        const leaveTypeSelect = row.querySelector('.att-leave-type')?.value || '';

        if (status === 'Present') {
            const workedMinutes = (arrivalTime && departureTime)
                ? computeWorkedMinutes(arrivalTime, departureTime)
                : 0;
            attendanceData[selectedDate][staffId] = {
                arrivalTime,
                departureTime,
                status: 'Present',
                leaveType: '',
                workedMinutes
            };
        } else {
            attendanceData[selectedDate][staffId] = {
                arrivalTime: '',
                departureTime: '',
                status: 'Leave',
                leaveType: leaveTypeSelect || 'None',
                workedMinutes: 0
            };
        }
    });

    // Rebuild annual leave totals from attendance so re-saving or changing Present/Leave stays exact
    const warnings = recalculateLeaveFromAttendance(year, selectedDate);

    saveData();

    warnings.forEach(msg => showToast(msg, 'warning'));
    showToast(`Attendance saved for ${formatDate(selectedDate)}.`, 'success');

    renderDailyAttendance();
    renderMonthlySummary();
}

/**
 * Format total minutes as "Xh Ym".
 * @param {number} totalMinutes
 * @returns {string}
 */
function formatHoursMinutes(totalMinutes) {
    const safeMins = Math.max(0, Math.round(totalMinutes || 0));
    const hours = Math.floor(safeMins / 60);
    const mins = safeMins % 60;
    return `${hours}h ${mins}m`;
}

/**
 * Render the monthly attendance summary table for the selected YYYY-MM month.
 */
function renderMonthlySummary() {
    const monthInput = document.getElementById('attendance-month');
    const tbody = document.getElementById('attendance-monthly-tbody');
    if (!monthInput || !tbody) return;

    const monthVal = monthInput.value;
    if (!monthVal || !monthVal.includes('-')) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <i class="fa-solid fa-calendar"></i>
                    Please select a valid month to view the summary.
                </td>
            </tr>
        `;
        return;
    }

    const [yearStr, monthStr] = monthVal.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const monthPrefix = `${yearStr}-${padZero(month)}-`;

    const workingDaysInMonth = getWorkingDaysCount(year, month);
    const requiredHours = workingDaysInMonth * STANDARD_DAILY_HOURS;
    const requiredMinutes = requiredHours * 60;

    if (staffs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state">
                    <i class="fa-solid fa-chart-column"></i>
                    No staff records found.
                </td>
            </tr>
        `;
        return;
    }

    const monthDates = Object.keys(attendanceData).filter(dateKey => dateKey.startsWith(monthPrefix));

    tbody.innerHTML = staffs.map(staff => {
        let presentDays = 0;
        let totalWorkedMinutes = 0;

        monthDates.forEach(dateKey => {
            const entry = attendanceData[dateKey]?.[staff.id];
            if (entry && String(entry.status).toLowerCase() === 'present') {
                presentDays += 1;
                totalWorkedMinutes += Number(entry.workedMinutes) || 0;
            }
        });

        const shortageMinutes = Math.max(0, requiredMinutes - totalWorkedMinutes);
        const overtimeMinutes = Math.max(0, totalWorkedMinutes - requiredMinutes);

        const shortageClass = shortageMinutes > 0 ? 'text-danger' : '';
        const overtimeClass = overtimeMinutes > 0 ? 'text-success' : '';

        return `
            <tr>
                <td><strong>${escapeHtml(staff.id)}</strong></td>
                <td>${escapeHtml(staff.name)}</td>
                <td>${presentDays}</td>
                <td>${requiredHours}h 0m</td>
                <td>${formatHoursMinutes(totalWorkedMinutes)}</td>
                <td class="${shortageClass}"><strong>${formatHoursMinutes(shortageMinutes)}</strong></td>
                <td class="${overtimeClass}"><strong>${formatHoursMinutes(overtimeMinutes)}</strong></td>
            </tr>
        `;
    }).join('');
}

// ============================================================================
// LEAVE TAB
// ============================================================================

/**
 * Rebuild all leave counts for a given year by scanning attendance entries chronologically.
 * Preserves awarded Extra Bonus totals while resetting attendance-derived leave usage.
 * @param {number|string} year
 * @param {string|null} [notifyDate=null] - Optional date to collect reclassification warnings for
 * @returns {Array<string>} Warning messages generated during recalculation
 */
function recalculateLeaveFromAttendance(year, notifyDate = null) {
    const yrNum = parseInt(year, 10) || DEFAULT_REF_YEAR;
    const yr = String(yrNum);
    initLeaveRecords(yr);

    // Reset all usage counts while preserving extraBonus.total
    Object.keys(leaveRecords[yr]).forEach(staffId => {
        const preservedBonusTotal = Number(leaveRecords[yr][staffId]?.extraBonus?.total) || 0;
        const fresh = createEmptyLeaveRecord();
        fresh.extraBonus.total = preservedBonusTotal;
        leaveRecords[yr][staffId] = fresh;
    });

    const warnings = [];
    const yearDates = Object.keys(attendanceData)
        .filter(dateKey => dateKey.startsWith(`${yr}-`))
        .sort();

    yearDates.forEach(dateKey => {
        const dayEntries = attendanceData[dateKey] || {};
        const month = parseInt(dateKey.split('-')[1], 10);
        if (Number.isNaN(month) || month < 1 || month > 12) return;

        Object.keys(dayEntries).forEach(staffId => {
            const entry = dayEntries[staffId];
            if (!entry || entry.status !== 'Leave') return;

            const staff = staffs.find(s => s.id === staffId);
            if (!staff) return;

            const { finalLeaveType, warning } = processLeaveForRecord(staff, yrNum, month, entry.leaveType);
            if (finalLeaveType !== entry.leaveType) {
                entry.leaveType = finalLeaveType;
            }
            if (warning && (!notifyDate || dateKey === notifyDate)) {
                warnings.push(warning);
            }
        });
    });

    return warnings;
}

/**
 * Render the 12-month Leave Summary table for the selected year.
 */
function renderLeaveSummary() {
    const yearInput = document.getElementById('leave-year');
    const tbody = document.getElementById('leave-summary-tbody');
    if (!yearInput || !tbody) return;

    const year = parseInt(yearInput.value, 10) || DEFAULT_REF_YEAR;
    initLeaveRecords(year);
    const yearRecords = leaveRecords[String(year)];

    if (staffs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="31" class="empty-state">
                    <i class="fa-solid fa-clipboard-list"></i>
                    No staff records found.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = staffs.map(staff => {
        const slab = staff.joinDate ? calculateSlab(staff.joinDate, year) : (staff.slab || 1);
        const entitlement = getEntitlement(slab, staff.gender);
        const record = normalizeLeaveRecord(yearRecords[staff.id]);

        let monthCellsHtml = '';
        let totalLeave = 0;
        let totalClaimed = 0;

        for (let m = 1; m <= 12; m++) {
            const usage = record.monthlyUsage[m];
            totalLeave += usage.total;
            totalClaimed += usage.claimed;
            monthCellsHtml += `<td>${usage.total}</td><td>${usage.claimed}</td>`;
        }

        const extraBonusTotal = record.extraBonus.total;
        const totalEligible = entitlement.total + extraBonusTotal;
        const balance = totalEligible - totalClaimed;
        const balanceClass = balance <= 0 ? 'text-danger' : 'text-success';

        return `
            <tr>
                <td>${escapeHtml(staff.name)}</td>
                <td><strong>${escapeHtml(staff.id)}</strong></td>
                ${monthCellsHtml}
                <td><strong>${totalEligible}</strong></td>
                <td>${totalLeave}</td>
                <td>${totalClaimed}</td>
                <td class="${balanceClass}"><strong>${balance}</strong></td>
                <td>${extraBonusTotal}</td>
            </tr>
        `;
    }).join('');
}

/**
 * Populate the staff dropdown inside the Leave Modal if present.
 */
function populateLeaveStaffSelect() {
    const select = document.getElementById('leave-staff-select');
    if (!select) return;

    const currentVal = select.value;
    select.innerHTML = staffs
        .map(s => `<option value="${escapeHtml(s.id)}">${escapeHtml(s.name)} (${escapeHtml(s.id)})</option>`)
        .join('');

    if (currentVal && staffs.some(s => s.id === currentVal)) {
        select.value = currentVal;
    }
}

/**
 * Handle manual leave/extra-bonus recording if the Leave Modal is used.
 * @param {Event} [e]
 */
function saveLeaveModalEntry(e) {
    if (e && typeof e.preventDefault === 'function') {
        e.preventDefault();
    }

    const staffId = document.getElementById('leave-staff-select')?.value;
    const month = parseInt(document.getElementById('leave-month-select')?.value, 10);
    const leaveType = document.getElementById('leave-type-select')?.value;
    const days = parseFloat(document.getElementById('leave-days')?.value);
    const isClaimed = Boolean(document.getElementById('leave-claimed')?.checked);
    const year = parseInt(document.getElementById('leave-year')?.value, 10) || DEFAULT_REF_YEAR;

    if (!staffId || Number.isNaN(month) || month < 1 || month > 12 || Number.isNaN(days) || days <= 0) {
        showToast('Please enter valid leave details.', 'error');
        return;
    }

    const staff = staffs.find(s => s.id === staffId);
    if (!staff) {
        showToast('Selected staff member not found.', 'error');
        return;
    }

    initLeaveRecords(year);
    const record = leaveRecords[String(year)][staffId];
    const monthBucket = record.monthlyUsage[month];

    if (leaveType === 'Extra Bonus') {
        record.extraBonus.total += days;
        if (isClaimed) {
            record.extraBonus.used += days;
            monthBucket.extraBonus += days;
            monthBucket.claimed += days;
            monthBucket.total += days;
        }
        showToast(`Added ${days} Extra Bonus day(s) for ${staff.name}.`, 'success');
    } else {
        const category = mapLeaveCategory(leaveType);
        const slab = staff.joinDate ? calculateSlab(staff.joinDate, year) : (staff.slab || 1);
        const entitlement = getEntitlement(slab, staff.gender);
        const monthlyLimit = getMonthlyLimit(slab);

        if (category === 'unpaid') {
            record.unpaid.used += days;
            monthBucket.unpaid += days;
            monthBucket.total += days;
            showToast(`Recorded ${days} Unpaid day(s) for ${staff.name}.`, 'success');
        } else {
            const available = entitlement[category] - record[category].used;
            if (monthBucket.claimed + days <= monthlyLimit && available >= days) {
                record[category].used += days;
                monthBucket[category] += days;
                monthBucket.claimed += days;
                monthBucket.total += days;
                showToast(`Recorded ${days} ${leaveType} day(s) for ${staff.name}.`, 'success');
            } else {
                record.unpaid.used += days;
                monthBucket.unpaid += days;
                monthBucket.total += days;
                showToast(`${staff.name}: Limit/balance exceeded — recorded ${days} day(s) as Unpaid.`, 'warning');
            }
        }
    }

    saveData();
    closeModal('leave-modal');
    renderLeaveSummary();
}

// ============================================================================
// CSV EXPORT
// ============================================================================

/**
 * Escape a CSV field value per RFC 4180.
 * @param {string|number} value
 * @returns {string}
 */
function csvEscape(value) {
    const str = String(value ?? '');
    if (/[",\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

/**
 * Export the current year's leave summary table data to a downloadable CSV file.
 */
function exportCSV() {
    if (staffs.length === 0) {
        showToast('No staff leave data available to export.', 'warning');
        return;
    }

    const yearInput = document.getElementById('leave-year');
    const year = parseInt(yearInput?.value, 10) || DEFAULT_REF_YEAR;
    initLeaveRecords(year);
    const yearRecords = leaveRecords[String(year)];

    const headers = ['Staff Name', 'ID'];
    MONTH_NAMES.forEach(monthName => {
        headers.push(`${monthName} Total`, `${monthName} Claimed`);
    });
    headers.push('Total Eligible', 'Total Leave', 'Claimed', 'Balance', 'Extra Bonus');

    const rows = [headers.map(csvEscape).join(',')];

    staffs.forEach(staff => {
        const slab = staff.joinDate ? calculateSlab(staff.joinDate, year) : (staff.slab || 1);
        const entitlement = getEntitlement(slab, staff.gender);
        const record = normalizeLeaveRecord(yearRecords[staff.id]);

        const row = [staff.name, staff.id];
        let totalLeave = 0;
        let totalClaimed = 0;

        for (let m = 1; m <= 12; m++) {
            const usage = record.monthlyUsage[m];
            totalLeave += usage.total;
            totalClaimed += usage.claimed;
            row.push(usage.total, usage.claimed);
        }

        const extraBonusTotal = record.extraBonus.total;
        const totalEligible = entitlement.total + extraBonusTotal;
        const balance = totalEligible - totalClaimed;

        row.push(totalEligible, totalLeave, totalClaimed, balance, extraBonusTotal);
        rows.push(row.map(csvEscape).join(','));
    });

    const csvContent = rows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `leave-summary-${year}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Leave summary for ${year} exported to CSV.`, 'success');
}

// ============================================================================
// MODALS
// ============================================================================

/**
 * Open a modal overlay by ID.
 * @param {string} id
 */
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.add('active');
    }
}

/**
 * Close a modal overlay by ID.
 * @param {string} id
 */
function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('active');
    }
    if (id === 'confirm-modal') {
        confirmAction = null;
    }
}

// ============================================================================
// TOAST NOTIFICATIONS
// ============================================================================

/**
 * Display a temporary toast notification in #toast-container.
 * @param {string} message
 * @param {'success'|'error'|'warning'|'info'} [type='success']
 */
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const iconMap = {
        success: 'fa-solid fa-circle-check',
        error: 'fa-solid fa-circle-exclamation',
        danger: 'fa-solid fa-circle-exclamation',
        warning: 'fa-solid fa-triangle-exclamation',
        info: 'fa-solid fa-circle-info'
    };

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icon = document.createElement('i');
    icon.className = iconMap[type] || iconMap.info;

    const text = document.createElement('span');
    text.textContent = message;

    toast.appendChild(icon);
    toast.appendChild(text);
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-exit');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// ============================================================================
// DARK MODE
// ============================================================================

/**
 * Apply dark or light mode state and update theme toggle icon.
 * @param {boolean} isDark
 */
function applyTheme(isDark) {
    document.body.classList.toggle('dark-mode', isDark);
    const icon = document.querySelector('#theme-toggle i');
    if (icon) {
        icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    }
}

/**
 * Toggle dark mode and save preference to localStorage.
 */
function toggleTheme() {
    const isDark = !document.body.classList.contains('dark-mode');
    applyTheme(isDark);
    localStorage.setItem(STORAGE_KEYS.THEME, String(isDark));
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Format an ISO date string (YYYY-MM-DD) as "DD MMM YYYY".
 * @param {string} dateStr
 * @returns {string}
 */
function formatDate(dateStr) {
    if (!dateStr) return '—';
    const parts = String(dateStr).split('-');
    if (parts.length !== 3) return String(dateStr);

    const year = parseInt(parts[0], 10);
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);

    if (Number.isNaN(year) || monthIndex < 0 || monthIndex > 11 || Number.isNaN(day)) {
        return String(dateStr);
    }

    return `${padZero(day)} ${MONTH_NAMES[monthIndex]} ${year}`;
}

/**
 * Count weekday working days (Mon–Fri) in a 1-indexed month of a given year.
 * @param {number} year
 * @param {number} month - 1-indexed (1..12)
 * @returns {number}
 */
function getWorkingDaysCount(year, month) {
    const daysInMonth = new Date(year, month, 0).getDate();
    let workingDays = 0;

    for (let day = 1; day <= daysInMonth; day++) {
        const dayOfWeek = new Date(year, month - 1, day).getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            workingDays += 1;
        }
    }

    return workingDays;
}

/**
 * Pad a number with a leading zero to ensure at least 2 digits.
 * @param {number|string} n
 * @returns {string}
 */
function padZero(n) {
    return String(n).padStart(2, '0');
}

/**
 * Escape HTML special characters for safe template rendering.
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ============================================================================
// INITIALIZATION & EVENT LISTENERS
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    // 1. Load persisted data & theme preference
    loadData();
    const savedDarkMode = localStorage.getItem(STORAGE_KEYS.THEME) === 'true';
    applyTheme(savedDarkMode);

    // 2. Initialize header & attendance date/month defaults using local date
    const now = new Date();
    const todayISO = `${now.getFullYear()}-${padZero(now.getMonth() + 1)}-${padZero(now.getDate())}`;
    const currentMonthISO = `${now.getFullYear()}-${padZero(now.getMonth() + 1)}`;

    const currentDateEl = document.getElementById('current-date');
    if (currentDateEl) {
        currentDateEl.textContent = formatDate(todayISO);
    }

    const attendanceDateInput = document.getElementById('attendance-date');
    if (attendanceDateInput) {
        attendanceDateInput.value = todayISO;
    }

    const attendanceMonthInput = document.getElementById('attendance-month');
    if (attendanceMonthInput) {
        attendanceMonthInput.value = currentMonthISO;
    }

    // 3. Navigation tabs
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            switchTab(link.dataset.tab);
        });
    });

    // 4. Staff tab listeners
    const addStaffBtn = document.getElementById('add-staff-btn');
    if (addStaffBtn) {
        addStaffBtn.addEventListener('click', () => openStaffModal('add'));
    }

    const staffForm = document.getElementById('staff-form');
    if (staffForm) {
        staffForm.addEventListener('submit', saveStaff);
    }

    const staffSaveBtn = document.getElementById('staff-save-btn');
    if (staffSaveBtn) {
        staffSaveBtn.addEventListener('click', saveStaff);
    }

    const staffSearchInput = document.getElementById('staff-search');
    if (staffSearchInput) {
        staffSearchInput.addEventListener('input', renderStaffs);
    }

    const staffsTbody = document.getElementById('staffs-tbody');
    if (staffsTbody) {
        staffsTbody.addEventListener('click', e => {
            const editBtn = e.target.closest('.edit-staff-btn');
            if (editBtn) {
                const idx = parseInt(editBtn.dataset.index, 10);
                if (!Number.isNaN(idx)) openStaffModal('edit', idx);
                return;
            }

            const deleteBtn = e.target.closest('.delete-staff-btn');
            if (deleteBtn) {
                const idx = parseInt(deleteBtn.dataset.index, 10);
                if (!Number.isNaN(idx)) deleteStaff(idx);
            }
        });
    }

    // 5. Attendance tab listeners
    if (attendanceDateInput) {
        attendanceDateInput.addEventListener('change', renderDailyAttendance);
    }

    if (attendanceMonthInput) {
        attendanceMonthInput.addEventListener('change', renderMonthlySummary);
    }

    const saveAttendanceBtn = document.getElementById('save-attendance-btn');
    if (saveAttendanceBtn) {
        saveAttendanceBtn.addEventListener('click', saveAttendance);
    }

    const dailyViewBtn = document.getElementById('daily-view-btn');
    const monthlyViewBtn = document.getElementById('monthly-view-btn');
    const dailySection = document.getElementById('daily-entry-section');
    const monthlySection = document.getElementById('monthly-summary-section');

    if (dailyViewBtn && monthlyViewBtn && dailySection && monthlySection) {
        dailyViewBtn.addEventListener('click', () => {
            dailySection.style.display = 'block';
            monthlySection.style.display = 'none';
            dailyViewBtn.classList.add('btn-primary');
            dailyViewBtn.classList.remove('btn-outline');
            monthlyViewBtn.classList.add('btn-outline');
            monthlyViewBtn.classList.remove('btn-primary');
            renderDailyAttendance();
        });

        monthlyViewBtn.addEventListener('click', () => {
            dailySection.style.display = 'none';
            monthlySection.style.display = 'block';
            monthlyViewBtn.classList.add('btn-primary');
            monthlyViewBtn.classList.remove('btn-outline');
            dailyViewBtn.classList.add('btn-outline');
            dailyViewBtn.classList.remove('btn-primary');
            renderMonthlySummary();
        });
    }

    // 6. Leave tab listeners
    const leaveYearInput = document.getElementById('leave-year');
    if (leaveYearInput) {
        leaveYearInput.addEventListener('change', renderLeaveSummary);
    }

    const exportLeaveBtn = document.getElementById('export-leave-btn');
    if (exportLeaveBtn) {
        exportLeaveBtn.addEventListener('click', exportCSV);
    }

    const leaveForm = document.getElementById('leave-form');
    if (leaveForm) {
        leaveForm.addEventListener('submit', saveLeaveModalEntry);
    }

    const leaveSaveBtn = document.getElementById('leave-save-btn');
    if (leaveSaveBtn) {
        leaveSaveBtn.addEventListener('click', saveLeaveModalEntry);
    }

    // 7. Theme toggle
    const themeToggleBtn = document.getElementById('theme-toggle');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', toggleTheme);
    }

    // 8. Modal close, cancel, overlay, and confirm handlers
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            if (modal) closeModal(modal.id);
        });
    });

    document.querySelectorAll('.modal-cancel').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = btn.closest('.modal');
            if (modal) closeModal(modal.id);
        });
    });

    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', e => {
            if (e.target === modal) {
                closeModal(modal.id);
            }
        });
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach(modal => {
                closeModal(modal.id);
            });
        }
    });

    const confirmYesBtn = document.getElementById('confirm-yes-btn');
    if (confirmYesBtn) {
        confirmYesBtn.addEventListener('click', () => {
            const pendingCallback = confirmAction;
            closeModal('confirm-modal');
            if (typeof pendingCallback === 'function') {
                pendingCallback();
            }
        });
    }

    // 9. Initial render
    renderStaffs();
});
