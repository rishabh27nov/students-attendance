// Application State Management with localStorage
const STORAGE_ATTENDANCE_KEY = 'educlass_attendance_logs_v1';
const STORAGE_MEETINGS_KEY = 'educlass_zoom_meetings_v1';
const STORAGE_GSHEET_KEY = 'educlass_gsheet_url_v1';

// Deployed Google Apps Script Webhook URL for Attendance Lakshya 2026
const DEFAULT_GSHEET_URL = 'https://script.google.com/macros/s/AKfycbzBf4mS5ytTTnbLsrofFVqE_PnWFHr7s9B2ArkzK2iEgT44mc-A9My7Ey90V6bi_aoEAg/exec';

// Auto-initialize Google Sheet Webhook URL if empty
if (!localStorage.getItem(STORAGE_GSHEET_KEY)) {
  localStorage.setItem(STORAGE_GSHEET_KEY, DEFAULT_GSHEET_URL);
}

// Helper: Format Date string to DD/MM/YYYY
function formatDisplayDate(dateStr) {
  if (!dateStr) {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  if (dateStr.includes('-')) {
    const parts = dateStr.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
  }
  return dateStr;
}

const getTodayISODate = () => new Date().toISOString().slice(0, 10);

// Default Meetings list if empty
const defaultMeetings = [
  {
    id: 'mtg_1',
    topic: '11 JEE Mathematics (Live Practice Session)',
    date: getTodayISODate(),
    slot: '12:00 AM - 11:59 PM',
    url: 'https://zoom.us/j/9876543210?pwd=MathsClassLink',
    passcode: '123456',
    targetBatches: ['11 JEE', '12 JEE']
  },
  {
    id: 'mtg_2',
    topic: '11 NEET Biology (Evening Batch)',
    date: getTodayISODate(),
    slot: '7:00 PM - 8:00 PM',
    url: 'https://zoom.us/j/9876543211?pwd=BiologyClassLink',
    passcode: '654321',
    targetBatches: ['11 NEET', '12 NEET']
  },
  {
    id: 'mtg_3',
    topic: '12 JEE Physics Special (Night Batch)',
    date: getTodayISODate(),
    slot: '9:00 PM - 10:00 PM',
    url: 'https://zoom.us/j/9876543212?pwd=PhysicsClassLink',
    passcode: '999888',
    targetBatches: ['12 JEE']
  }
];

// Initialize Application Data
let attendanceLogs = JSON.parse(localStorage.getItem(STORAGE_ATTENDANCE_KEY)) || [];
let meetingsList = JSON.parse(localStorage.getItem(STORAGE_MEETINGS_KEY)) || defaultMeetings;

// Mock initial data if logs empty
if (attendanceLogs.length === 0) {
  const now = new Date();
  attendanceLogs = [
    {
      id: 'att_1',
      name: 'Rohan Sharma',
      class: '11 JEE',
      course: 'JEE Mathematics',
      classDate: getTodayISODate(),
      formattedClassDate: formatDisplayDate(getTodayISODate()),
      timeSlot: '6:00 PM - 7:00 PM',
      meetingId: 'mtg_1',
      timestamp: new Date(now.getTime() - 1000 * 60 * 50).toISOString(),
      formattedDate: new Date(now.getTime() - 1000 * 60 * 50).toLocaleString('en-IN')
    },
    {
      id: 'att_2',
      name: 'Ananya Gupta',
      class: '11 NEET',
      course: 'NEET Biology',
      classDate: getTodayISODate(),
      formattedClassDate: formatDisplayDate(getTodayISODate()),
      timeSlot: '7:00 PM - 8:00 PM',
      meetingId: 'mtg_2',
      timestamp: new Date(now.getTime() - 1000 * 60 * 10).toISOString(),
      formattedDate: new Date(now.getTime() - 1000 * 60 * 10).toLocaleString('en-IN')
    }
  ];
  saveLogsToStorage();
}

// Storage helpers
function saveLogsToStorage() {
  localStorage.setItem(STORAGE_ATTENDANCE_KEY, JSON.stringify(attendanceLogs));
}

function saveMeetingsToStorage() {
  localStorage.setItem(STORAGE_MEETINGS_KEY, JSON.stringify(meetingsList));

  // Sync Meeting Config to Cloud (Google Apps Script) so all browsers/devices see it instantly
  const gsheetUrl = localStorage.getItem(STORAGE_GSHEET_KEY) || DEFAULT_GSHEET_URL;
  if (gsheetUrl) {
    try {
      fetch(gsheetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'saveMeetings', meetings: meetingsList })
      });
    } catch (e) {
      console.log('Cloud meeting save notice:', e);
    }
  }
}

// Fetch Live Meetings from Cloud (Google Apps Script) for Cross-Browser / Multi-Device Sync
function fetchLiveMeetingsFromCloud() {
  const gsheetUrl = localStorage.getItem(STORAGE_GSHEET_KEY) || DEFAULT_GSHEET_URL;
  if (!gsheetUrl) return;

  fetch(`${gsheetUrl}?action=getMeetings`)
    .then(res => res.json())
    .then(data => {
      if (data && data.status === 'success' && Array.isArray(data.meetings) && data.meetings.length > 0) {
        meetingsList = data.meetings;
        localStorage.setItem(STORAGE_MEETINGS_KEY, JSON.stringify(meetingsList));
        renderMeetingsListTable();
        const selectedClass = document.getElementById('studentClass') ? document.getElementById('studentClass').value : '';
        populateStudentMeetingDropdown(selectedClass);
      }
    })
    .catch(err => {
      console.log('Using local meeting storage cache:', err);
    });
}

// DOM Initialization
document.addEventListener('DOMContentLoaded', () => {
  const dateInput = document.getElementById('newMeetingDate');
  if (dateInput) {
    dateInput.value = getTodayISODate();
  }
  populate12HourDropdowns();
  renderMeetingsListTable();
  populateStudentMeetingDropdown();
  renderAttendanceTable();
  updateStats();
  fetchLiveMeetingsFromCloud();

  // Auto-sync live meetings every 10 seconds across all devices
  setInterval(fetchLiveMeetingsFromCloud, 10000);
});

// Populate 12-Hour Hour & Complete 60 Minute Dropdowns
function populate12HourDropdowns() {
  const startHourSelect = document.getElementById('startHour');
  const endHourSelect = document.getElementById('endHour');
  const startMinSelect = document.getElementById('startMin');
  const endMinSelect = document.getElementById('endMin');

  if (!startHourSelect || !endHourSelect) return;

  // Hours 1 to 12
  startHourSelect.innerHTML = '';
  endHourSelect.innerHTML = '';

  for (let i = 1; i <= 12; i++) {
    const optStart = document.createElement('option');
    optStart.value = i;
    optStart.textContent = i;
    if (i === 6) optStart.selected = true; // Default 6
    startHourSelect.appendChild(optStart);

    const optEnd = document.createElement('option');
    optEnd.value = i;
    optEnd.textContent = i;
    if (i === 7) optEnd.selected = true; // Default 7
    endHourSelect.appendChild(optEnd);
  }

  // All 60 Minutes (00 to 59)
  if (startMinSelect && endMinSelect) {
    startMinSelect.innerHTML = '';
    endMinSelect.innerHTML = '';

    for (let m = 0; m < 60; m++) {
      const val = m < 10 ? '0' + m : '' + m;

      const optStartMin = document.createElement('option');
      optStartMin.value = val;
      optStartMin.textContent = val;
      startMinSelect.appendChild(optStartMin);

      const optEndMin = document.createElement('option');
      optEndMin.value = val;
      optEndMin.textContent = val;
      endMinSelect.appendChild(optEndMin);
    }
  }
}

// Get Formatted 12-Hour Slot String
function getFormatted12HourSlot() {
  const startH = document.getElementById('startHour').value;
  const startM = document.getElementById('startMin').value;
  const startAmpm = document.getElementById('startAmpm').value;

  const endH = document.getElementById('endHour').value;
  const endM = document.getElementById('endMin').value;
  const endAmpm = document.getElementById('endAmpm').value;

  return `${startH}:${startM} ${startAmpm} - ${endH}:${endM} ${endAmpm}`;
}

// Time Slot Active Status Checker (with Date & 2-Minute Early Access Buffer)
function checkMeetingTimeStatus(slotStr, meetingDateStr) {
  if (!slotStr) return { status: 'LIVE', isActive: true, label: '🟢 LIVE NOW' };

  try {
    const parts = slotStr.split('-').map(s => s.trim());
    if (parts.length !== 2) return { status: 'LIVE', isActive: true, label: '🟢 LIVE NOW' };

    const now = new Date();
    const todayStr = getTodayISODate();
    const formattedMtgDate = formatDisplayDate(meetingDateStr || todayStr);

    // If meeting date is set and is in the future
    if (meetingDateStr && meetingDateStr > todayStr) {
      return { status: 'UPCOMING', isActive: false, label: `🔒 UPCOMING (${formattedMtgDate})` };
    }

    // If meeting date is in the past
    if (meetingDateStr && meetingDateStr < todayStr) {
      return { status: 'ENDED', isActive: false, label: `⌛ CLASS ENDED (${formattedMtgDate})` };
    }

    const startTime = parseTimeStringToDate(parts[0], now);
    const endTime = parseTimeStringToDate(parts[1], now);

    // 2 Minutes Early Access Buffer (e.g. 7:58 PM for an 8:00 PM class)
    const earlyStartTime = new Date(startTime.getTime() - 2 * 60 * 1000);

    if (now >= earlyStartTime && now <= endTime) {
      return { status: 'LIVE', isActive: true, label: '🟢 LIVE NOW' };
    } else if (now < earlyStartTime) {
      return { status: 'UPCOMING', isActive: false, label: `🔒 UPCOMING (${parts[0]})` };
    } else {
      return { status: 'ENDED', isActive: false, label: '⌛ CLASS ENDED' };
    }
  } catch (e) {
    return { status: 'LIVE', isActive: true, label: '🟢 LIVE NOW' };
  }
}

function parseTimeStringToDate(timeStr, referenceDate) {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return new Date();

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();

  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;

  const d = new Date(referenceDate);
  d.setHours(hours, minutes, 0, 0);
  return d;
}

// Populate Student View Meeting Dropdown & Admin Filter
function populateStudentMeetingDropdown(selectedStudentClass = '') {
  const selectElem = document.getElementById('studentMeetingSelect');
  const timeSlotElem = document.getElementById('studentTimeSlot');
  const filterSlotSelect = document.getElementById('filterTimeSlot');

  if (!selectElem) return;

  // Preserve student's current selection if already chosen
  const previousSelectedVal = selectElem.value;

  if (!selectedStudentClass) {
    selectElem.innerHTML = '<option value="" disabled selected>-- Please Select Your Class / Batch First --</option>';
    if (timeSlotElem) {
      timeSlotElem.innerHTML = '<option value="" disabled selected>-- Select Zoom Meeting First --</option>';
    }
    return;
  }

  // Filter meetings based on Student's Selected Class/Batch
  const eligibleMeetings = meetingsList.filter(m => {
    const batches = m.targetBatches || (m.targetClass ? [m.targetClass] : []);
    if (batches.includes('All Batches') || batches.includes('All Classes / General') || batches.length === 0) {
      return true;
    }
    return batches.includes(selectedStudentClass);
  });

  selectElem.innerHTML = '<option value="" disabled selected>-- Select Active Live Class --</option>';
  
  if (eligibleMeetings.length === 0) {
    selectElem.innerHTML = '<option value="" disabled selected>No active meetings configured for your batch</option>';
  } else {
    eligibleMeetings.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;

      const timeStatus = checkMeetingTimeStatus(m.slot, m.date);
      const displayDate = formatDisplayDate(m.date || getTodayISODate());

      if (timeStatus.isActive) {
        // Active / Current Class: Enabled & Clickable
        opt.textContent = `${timeStatus.label}: ${m.topic} (${displayDate} | ${m.slot})`;
        opt.disabled = false;
        opt.style.fontWeight = '700';
        opt.style.color = '#fff';
      } else {
        // Inactive Class: Disabled & Semi-Transparent
        opt.textContent = `${timeStatus.label}: ${m.topic} (${displayDate} | ${m.slot})`;
        opt.disabled = true;
        opt.style.opacity = '0.4';
        opt.style.color = 'rgba(255, 255, 255, 0.45)';
      }

      selectElem.appendChild(opt);
    });

    // Restore student's previously selected meeting value if valid
    if (previousSelectedVal && Array.from(selectElem.options).some(opt => opt.value === previousSelectedVal)) {
      selectElem.value = previousSelectedVal;
      onStudentMeetingChange();
    }
  }

  // Reset Time Slot Dropdown only if no meeting is selected
  if (timeSlotElem && !selectElem.value) {
    timeSlotElem.innerHTML = '<option value="" disabled selected>-- Select Zoom Meeting First --</option>';
  }

  if (filterSlotSelect) {
    const uniqueSlots = [...new Set(meetingsList.map(m => m.slot))];
    filterSlotSelect.innerHTML = '<option value="ALL">All Time Slots</option>';
    uniqueSlots.forEach(slot => {
      const opt = document.createElement('option');
      opt.value = slot;
      opt.textContent = slot;
      filterSlotSelect.appendChild(opt);
    });
  }
}

// Triggered when Student changes Class dropdown
function filterMeetingsForStudent() {
  const selectedClass = document.getElementById('studentClass').value;
  populateStudentMeetingDropdown(selectedClass);
  fetchLiveMeetingsFromCloud();
}

// Auto-fill details when Student chooses a Meeting
function onStudentMeetingChange() {
  const meetingId = document.getElementById('studentMeetingSelect').value;
  const timeSlotElem = document.getElementById('studentTimeSlot');
  const meeting = meetingsList.find(m => m.id === meetingId);

  if (meeting && timeSlotElem) {
    timeSlotElem.innerHTML = `<option value="${escapeHtml(meeting.slot)}" selected>${escapeHtml(meeting.slot)}</option>`;
  }
}

// Render Meetings Table in Teacher Dashboard
function renderMeetingsListTable() {
  const tbody = document.getElementById('meetingsListBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (meetingsList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No meetings configured yet. Click "+ Add New Meeting" above to create one.</td></tr>`;
    return;
  }

  meetingsList.forEach((m, idx) => {
    const tr = document.createElement('tr');
    const batchesArr = m.targetBatches || (m.targetClass ? [m.targetClass] : ['All Batches']);
    const targetDisplay = batchesArr.join(', ');
    const displayDate = formatDisplayDate(m.date || getTodayISODate());

    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td><span class="badge-tag" style="background: rgba(16, 185, 129, 0.15); color: #6ee7b7;"><i class="fa-solid fa-calendar-day"></i> ${escapeHtml(displayDate)}</span></td>
      <td><strong>${escapeHtml(m.topic)}</strong></td>
      <td><span class="badge-tag" style="background: rgba(99, 102, 241, 0.2); color: #a5b4fc;"><i class="fa-regular fa-clock"></i> ${escapeHtml(m.slot)}</span></td>
      <td><code>${escapeHtml(m.passcode || 'None')}</code></td>
      <td><span class="badge-tag" style="background: rgba(16, 185, 129, 0.15); color: #6ee7b7;"><i class="fa-solid fa-check-double"></i> ${escapeHtml(targetDisplay)}</span></td>
      <td>
        <a href="${escapeHtml(m.url)}" target="_blank" style="color: var(--zoom-blue); text-decoration: none; font-size: 0.85rem;" title="${escapeHtml(m.url)}">
          <i class="fa-solid fa-arrow-up-right-from-square"></i> Open Link
        </a>
      </td>
      <td>
        <button class="btn-icon-primary" title="Edit Meeting" onclick="editMeeting('${m.id}')">
          <i class="fa-solid fa-pen-to-square"></i>
        </button>
        <button class="btn-icon-danger" title="Delete Meeting" onclick="deleteMeeting('${m.id}')">
          <i class="fa-solid fa-trash"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Toggle Add Meeting Form Visibility
function toggleAddMeetingForm() {
  const form = document.getElementById('addMeetingForm');
  if (form) {
    if (form.style.display === 'none' || form.classList.contains('hidden')) {
      form.style.display = 'block';
      form.classList.remove('hidden');
    } else {
      form.style.display = 'none';
    }
  }
}

// Edit Meeting Handler
function editMeeting(id) {
  const meeting = meetingsList.find(m => m.id === id);
  if (!meeting) return;

  const form = document.getElementById('addMeetingForm');
  if (form) {
    form.style.display = 'block';
    form.classList.remove('hidden');
  }

  document.getElementById('editingMeetingId').value = meeting.id;

  const topicSelect = document.getElementById('newMeetingTopic');
  if (topicSelect) {
    let foundOption = Array.from(topicSelect.options).some(opt => opt.value === meeting.topic);
    if (!foundOption) {
      const opt = document.createElement('option');
      opt.value = meeting.topic;
      opt.textContent = meeting.topic;
      topicSelect.appendChild(opt);
    }
    topicSelect.value = meeting.topic;
  }

  const dateInput = document.getElementById('newMeetingDate');
  if (dateInput) {
    dateInput.value = meeting.date || getTodayISODate();
  }

  document.getElementById('newMeetingUrl').value = meeting.url || '';
  document.getElementById('newMeetingPasscode').value = meeting.passcode || '';

  // Parse time slot e.g. "6:00 PM - 7:00 PM"
  if (meeting.slot && meeting.slot.includes('-')) {
    const parts = meeting.slot.split('-').map(s => s.trim());
    if (parts.length === 2) {
      const startMatch = parts[0].match(/(\d+):(\d+)\s*(AM|PM)/i);
      const endMatch = parts[1].match(/(\d+):(\d+)\s*(AM|PM)/i);

      if (startMatch) {
        document.getElementById('startHour').value = parseInt(startMatch[1], 10);
        document.getElementById('startMin').value = startMatch[2];
        document.getElementById('startAmpm').value = startMatch[3].toUpperCase();
      }

      if (endMatch) {
        document.getElementById('endHour').value = parseInt(endMatch[1], 10);
        document.getElementById('endMin').value = endMatch[2];
        document.getElementById('endAmpm').value = endMatch[3].toUpperCase();
      }
    }
  }

  // Populate target batch checkboxes
  const targetBatches = meeting.targetBatches || (meeting.targetClass ? [meeting.targetClass] : []);
  const checkboxes = document.querySelectorAll('input[name="targetBatchCheck"]');
  checkboxes.forEach(cb => {
    cb.checked = targetBatches.includes(cb.value);
  });

  document.getElementById('formTitleHeading').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Edit Live Class Meeting';
  document.getElementById('btnSaveMeeting').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Update Meeting';
  document.getElementById('btnCancelEdit').style.display = 'inline-block';

  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  showToast(`Editing: ${meeting.topic}`, 'fa-pen-to-square');
}

// Cancel Edit Mode
function cancelEditMeeting() {
  document.getElementById('editingMeetingId').value = '';
  document.getElementById('addMeetingForm').reset();
  const dateInput = document.getElementById('newMeetingDate');
  if (dateInput) {
    dateInput.value = getTodayISODate();
  }
  populate12HourDropdowns();

  document.getElementById('formTitleHeading').innerHTML = '<i class="fa-solid fa-square-plus"></i> Add New Live Class Meeting';
  document.getElementById('btnSaveMeeting').innerHTML = '<i class="fa-solid fa-plus"></i> Add Meeting';
  document.getElementById('btnCancelEdit').style.display = 'none';
}

// Handle Add / Edit Meeting Submission
function handleAddNewMeeting(event) {
  event.preventDefault();

  const editingId = document.getElementById('editingMeetingId').value;
  const topic = document.getElementById('newMeetingTopic').value.trim();
  const meetingDate = document.getElementById('newMeetingDate') ? document.getElementById('newMeetingDate').value : getTodayISODate();
  const slot = getFormatted12HourSlot();
  const url = document.getElementById('newMeetingUrl').value.trim();
  const passcode = document.getElementById('newMeetingPasscode').value.trim();

  const checkedBoxes = document.querySelectorAll('input[name="targetBatchCheck"]:checked');
  let selectedBatches = Array.from(checkedBoxes).map(cb => cb.value);

  if (selectedBatches.length === 0) {
    showToast('Please select at least one target batch for the meeting!', 'fa-triangle-exclamation');
    return;
  }

  if (!topic || !url) {
    showToast('Meeting Title and Zoom Link are required!', 'fa-triangle-exclamation');
    return;
  }

  if (editingId) {
    // Update existing meeting
    const index = meetingsList.findIndex(m => m.id === editingId);
    if (index !== -1) {
      meetingsList[index] = {
        ...meetingsList[index],
        topic: topic,
        date: meetingDate,
        slot: slot,
        url: url,
        passcode: passcode || '',
        targetBatches: selectedBatches
      };
      showToast(`Meeting "${topic}" updated!`, 'fa-circle-check');
    }
  } else {
    // Add new meeting
    const newMeeting = {
      id: 'mtg_' + Date.now(),
      topic: topic,
      date: meetingDate,
      slot: slot,
      url: url,
      passcode: passcode || '',
      targetBatches: selectedBatches
    };
    meetingsList.push(newMeeting);
    showToast(`New Zoom meeting added for ${formatDisplayDate(meetingDate)}!`, 'fa-circle-check');
  }

  saveMeetingsToStorage();
  cancelEditMeeting();

  renderMeetingsListTable();
  populateStudentMeetingDropdown();
}

// Delete Meeting
function deleteMeeting(id) {
  if (confirm('Are you sure you want to delete this meeting?')) {
    meetingsList = meetingsList.filter(m => m.id !== id);
    saveMeetingsToStorage();
    renderMeetingsListTable();
    populateStudentMeetingDropdown();
    showToast('Meeting deleted successfully.', 'fa-trash');
  }
}

// Teacher Password Authentication
const STORAGE_TEACHER_PASS_KEY = 'educlass_teacher_pass_v1';
const DEFAULT_TEACHER_PASS = 'Admin@11223344';

function getTeacherPassword() {
  return localStorage.getItem(STORAGE_TEACHER_PASS_KEY) || DEFAULT_TEACHER_PASS;
}

// View Navigation Switcher (Protected by Password)
function switchView(viewName) {
  const studentSec = document.getElementById('studentSection');
  const adminSec = document.getElementById('adminSection');
  const btnStudent = document.getElementById('btnStudentView');
  const btnAdmin = document.getElementById('btnAdminView');

  if (viewName === 'student') {
    studentSec.classList.add('active');
    adminSec.classList.remove('active');
    btnStudent.classList.add('active');
    btnAdmin.classList.remove('active');
    filterMeetingsForStudent();
  } else {
    // Check if Teacher Dashboard is unlocked
    const isUnlocked = sessionStorage.getItem('teacher_unlocked') === 'true';
    if (!isUnlocked) {
      openTeacherAuthModal();
      return;
    }

    adminSec.classList.add('active');
    studentSec.classList.remove('active');
    btnAdmin.classList.add('active');
    btnStudent.classList.remove('active');
    
    renderMeetingsListTable();
    populateStudentMeetingDropdown();
    renderAttendanceTable();
    updateStats();
  }
}

// Teacher Password Auth Modal Helpers
function openTeacherAuthModal() {
  const modal = document.getElementById('teacherAuthModal');
  const input = document.getElementById('teacherPassInput');
  const errorBox = document.getElementById('loginErrorMsg');

  if (errorBox) errorBox.classList.add('hidden');

  if (modal) {
    if (input) input.value = '';
    modal.classList.remove('hidden');
    if (input) input.focus();
  }
}

function closeTeacherAuthModal() {
  const modal = document.getElementById('teacherAuthModal');
  const errorBox = document.getElementById('loginErrorMsg');
  if (errorBox) errorBox.classList.add('hidden');
  if (modal) modal.classList.add('hidden');
}

function handleTeacherLogin(event) {
  event.preventDefault();

  const inputPass = document.getElementById('teacherPassInput').value;
  const actualPass = getTeacherPassword();
  const errorBox = document.getElementById('loginErrorMsg');
  const modalBox = document.querySelector('#teacherAuthModal > div');

  if (inputPass === actualPass) {
    sessionStorage.setItem('teacher_unlocked', 'true');
    if (errorBox) errorBox.classList.add('hidden');
    closeTeacherAuthModal();
    showToast('Teacher Dashboard Unlocked!', 'fa-shield-halved');
    switchView('admin');
  } else {
    // Show error message box directly inside the Login Modal!
    if (errorBox) {
      errorBox.classList.remove('hidden');
    }

    // Trigger Shake Animation on Login Box
    if (modalBox) {
      modalBox.classList.remove('shake-modal');
      void modalBox.offsetWidth; // Trigger reflow
      modalBox.classList.add('shake-modal');
    }

    // Also display floating Toast alert above modal
    showToast('Incorrect Password! Access Denied.', 'fa-triangle-exclamation');

    const input = document.getElementById('teacherPassInput');
    if (input) {
      input.value = '';
      input.focus();
    }
  }
}

function lockTeacherDashboard() {
  sessionStorage.removeItem('teacher_unlocked');
  switchView('student');
  showToast('Teacher Dashboard Locked.', 'fa-lock');
}

function togglePassVisibility() {
  const input = document.getElementById('teacherPassInput');
  const icon = document.getElementById('passEyeIcon');
  if (input && icon) {
    if (input.type === 'password') {
      input.type = 'text';
      icon.className = 'fa-solid fa-eye-slash';
    } else {
      input.type = 'password';
      icon.className = 'fa-solid fa-eye';
    }
  }
}

// Handle Student Attendance Submission
let activeSubmittedMeeting = null;

function handleAttendanceSubmit(event) {
  event.preventDefault();

  const name = document.getElementById('studentName').value.trim();
  const meetingId = document.getElementById('studentMeetingSelect').value;
  const studentClass = document.getElementById('studentClass').value;
  const timeSlot = document.getElementById('studentTimeSlot').value;

  if (!name || !meetingId || !studentClass || !timeSlot) {
    showToast('Please fill all mandatory fields and select a meeting!', 'fa-triangle-exclamation');
    return;
  }

  const selectedMeeting = meetingsList.find(m => m.id === meetingId) || {
    topic: `Live Class`,
    date: getTodayISODate(),
    url: '#',
    passcode: ''
  };

  const course = selectedMeeting.topic || `${studentClass} Live Class`;
  const classDate = selectedMeeting.date || getTodayISODate();
  const formattedClassDate = formatDisplayDate(classDate);

  activeSubmittedMeeting = selectedMeeting;

  const now = new Date();
  const newEntry = {
    id: 'att_' + Date.now(),
    name: name,
    class: studentClass,
    course: course,
    classDate: classDate,
    formattedClassDate: formattedClassDate,
    timeSlot: timeSlot,
    meetingId: meetingId,
    meetingTopic: selectedMeeting.topic,
    timestamp: now.toISOString(),
    formattedDate: now.toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short'
    })
  };

  // Save entry
  attendanceLogs.unshift(newEntry);
  saveLogsToStorage();

  // Live Sync to Google Sheet Webhook if configured (Single clean POST to prevent duplicate entries)
  const gsheetUrl = localStorage.getItem('educlass_gsheet_url_v1') || DEFAULT_GSHEET_URL;
  if (gsheetUrl) {
    try {
      fetch(gsheetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(newEntry)
      });
    } catch (e) {
      console.log('Google Sheet sync notice:', e);
    }
  }

  // Populate Success Zoom Card with EXACT selected meeting details
  document.getElementById('studentGreeting').innerText = `Welcome ${name}! Your attendance for ${selectedMeeting.topic} (${studentClass}) has been recorded for ${formattedClassDate}.`;
  document.getElementById('displayTopic').innerText = selectedMeeting.topic;
  document.getElementById('displayTime').innerText = `Scheduled Date: ${formattedClassDate} | Slot: ${timeSlot}`;
  
  if (selectedMeeting.passcode) {
    document.getElementById('displayPasscode').innerText = selectedMeeting.passcode;
    document.getElementById('passcodeWrapper').style.display = 'block';
  } else {
    document.getElementById('passcodeWrapper').style.display = 'none';
  }

  // Set Zoom link to the exact selected meeting's link
  const zoomBtn = document.getElementById('zoomDirectLink');
  zoomBtn.href = selectedMeeting.url || '#';

  // Toggle View Cards
  document.getElementById('formCard').classList.add('hidden');
  document.getElementById('successZoomCard').classList.remove('hidden');

  showToast(`Attendance marked for ${selectedMeeting.topic}!`, 'fa-circle-check');
}

// Reset Student Form for another entry
function resetFormView() {
  document.getElementById('attendanceForm').reset();
  document.getElementById('formCard').classList.remove('hidden');
  document.getElementById('successZoomCard').classList.add('hidden');
  filterMeetingsForStudent();
}

// Google Sheets Modal Helpers
function openGSheetModal() {
  const modal = document.getElementById('gsheetModal');
  const input = document.getElementById('gsheetWebhookUrlInput');
  if (modal) {
    if (input) input.value = localStorage.getItem(STORAGE_GSHEET_KEY) || DEFAULT_GSHEET_URL;
    modal.classList.remove('hidden');
  }
}

function closeGSheetModal() {
  const modal = document.getElementById('gsheetModal');
  if (modal) modal.classList.add('hidden');
}

function saveGSheetWebhookUrl() {
  const input = document.getElementById('gsheetWebhookUrlInput');
  if (input) {
    const url = input.value.trim();
    localStorage.setItem(STORAGE_GSHEET_KEY, url);
    closeGSheetModal();
    if (url) {
      showToast('Google Sheet Webhook URL saved & connected!', 'fa-circle-check');
    } else {
      showToast('Google Sheet Webhook URL cleared.', 'fa-circle-info');
    }
  }
}

// Copy Zoom Link to Clipboard
function copyZoomLink() {
  const link = activeSubmittedMeeting ? activeSubmittedMeeting.url : (meetingsList[0] ? meetingsList[0].url : '');
  if (!link) {
    showToast('No Zoom link available', 'fa-triangle-exclamation');
    return;
  }

  navigator.clipboard.writeText(link).then(() => {
    showToast('Zoom Link copied to clipboard!', 'fa-copy');
  }).catch(() => {
    showToast('Copy failed, please click the join button directly.', 'fa-triangle-exclamation');
  });
}

// ADMIN DASHBOARD ATTENDANCE LOG FUNCTIONS

// Render Attendance Table Grouped by Class Scheduled Date
function renderAttendanceTable() {
  const tbody = document.getElementById('attendanceTableBody');
  const emptyState = document.getElementById('emptyState');
  const searchInput = document.getElementById('searchInput');
  const search = searchInput ? searchInput.value.toLowerCase().trim() : '';
  const filterClass = document.getElementById('filterClass') ? document.getElementById('filterClass').value : 'ALL';
  const filterTimeSlot = document.getElementById('filterTimeSlot') ? document.getElementById('filterTimeSlot').value : 'ALL';

  tbody.innerHTML = '';

  const filtered = attendanceLogs.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search) || 
                          item.course.toLowerCase().includes(search) || 
                          (item.timeSlot && item.timeSlot.toLowerCase().includes(search));
    const matchesClass = (filterClass === 'ALL') || (item.class === filterClass);
    const matchesTimeSlot = (filterTimeSlot === 'ALL') || (item.timeSlot === filterTimeSlot);

    return matchesSearch && matchesClass && matchesTimeSlot;
  });

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  } else {
    emptyState.classList.add('hidden');
  }

  // Group logs by formatted Class Date
  const groupedByDate = {};
  filtered.forEach(log => {
    const dateKey = log.formattedClassDate || formatDisplayDate(log.classDate || getTodayISODate());
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
    groupedByDate[dateKey].push(log);
  });

  let overallIndex = 1;

  Object.keys(groupedByDate).forEach(dateKey => {
    const logsForDate = groupedByDate[dateKey];

    // Date Group Header Row
    const headerTr = document.createElement('tr');
    headerTr.style.background = 'rgba(99, 102, 241, 0.15)';
    headerTr.style.borderTop = '2px solid var(--primary)';

    headerTr.innerHTML = `
      <td colspan="7" style="font-weight: 700; color: #a5b4fc; font-size: 0.95rem; padding: 0.75rem 1rem;">
        <i class="fa-solid fa-calendar-days"></i> Class Scheduled Date: ${escapeHtml(dateKey)} &nbsp;<span style="font-size: 0.8rem; font-weight: 500; color: var(--text-muted);">(${logsForDate.length} attendance records)</span>
      </td>
    `;
    tbody.appendChild(headerTr);

    logsForDate.forEach((log) => {
      const tr = document.createElement('tr');
      const slotDisplay = log.timeSlot || 'Standard Slot';

      tr.innerHTML = `
        <td>${overallIndex++}</td>
        <td><strong>${escapeHtml(log.name)}</strong></td>
        <td><span class="badge-tag">${escapeHtml(log.class)}</span></td>
        <td><strong>${escapeHtml(log.course)}</strong></td>
        <td><span class="badge-tag" style="background: rgba(99, 102, 241, 0.2); color: #a5b4fc;"><i class="fa-regular fa-clock"></i> ${escapeHtml(slotDisplay)}</span></td>
        <td><i class="fa-regular fa-calendar-check" style="color: var(--text-muted); font-size: 0.8rem;"></i> ${log.formattedDate}</td>
        <td>
          <button class="btn-icon-danger" title="Delete record" onclick="deleteLogEntry('${log.id}')">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    });
  });
}

// Delete single log entry
function deleteLogEntry(id) {
  if (confirm('Are you sure you want to delete this record?')) {
    attendanceLogs = attendanceLogs.filter(item => item.id !== id);
    saveLogsToStorage();
    renderAttendanceTable();
    updateStats();
    showToast('Record deleted successfully.', 'fa-trash');
  }
}

// Confirm Clear All Logs
function confirmClearLogs() {
  if (attendanceLogs.length === 0) {
    showToast('No attendance log records to clear.', 'fa-circle-info');
    return;
  }

  if (confirm('CAUTION: Are you sure you want to clear all attendance records?')) {
    attendanceLogs = [];
    saveLogsToStorage();
    renderAttendanceTable();
    updateStats();
    showToast('All attendance records have been cleared!', 'fa-trash-can');
  }
}

// Update Dashboard Counters
function updateStats() {
  const totalCount = attendanceLogs.length;
  
  const todayStr = new Date().toDateString();
  const todayCount = attendanceLogs.filter(item => {
    return new Date(item.timestamp).toDateString() === todayStr;
  }).length;

  const uniqueCourses = new Set(attendanceLogs.map(item => item.course.toLowerCase())).size;

  document.getElementById('statTotal').innerText = totalCount;
  document.getElementById('statToday').innerText = todayCount;
  document.getElementById('statCourses').innerText = uniqueCourses;
}

// Export Attendance Logs to CSV (Structured Vertically into Class 11 and Class 12 Sections & Grouped Date-by-Date)
function exportToCSV() {
  if (attendanceLogs.length === 0) {
    showToast('No attendance data available to export!', 'fa-triangle-exclamation');
    return;
  }

  const logs11 = attendanceLogs.filter(log => log.class && log.class.includes('11'));
  const logs12 = attendanceLogs.filter(log => log.class && log.class.includes('12'));
  const otherLogs = attendanceLogs.filter(log => !log.class || (!log.class.includes('11') && !log.class.includes('12')));

  let csvContent = 'data:text/csv;charset=utf-8,';

  // Helper to group array by date
  const groupLogsByDate = (logArr) => {
    const map = {};
    logArr.forEach(l => {
      const d = l.formattedClassDate || formatDisplayDate(l.classDate || getTodayISODate());
      if (!map[d]) map[d] = [];
      map[d].push(l);
    });
    return map;
  };

  // SECTION 1: CLASS 11TH ATTENDANCE (11 JEE & 11 NEET)
  csvContent += '========================================================================================\n';
  csvContent += '===                     CLASS 11TH ATTENDANCE LOGS (11 JEE & 11 NEET)                ===\n';
  csvContent += '========================================================================================\n';

  if (logs11.length === 0) {
    csvContent += '-,No Class 11th attendance records found,,,,,\n';
  } else {
    const grouped11 = groupLogsByDate(logs11);
    Object.keys(grouped11).forEach(dateKey => {
      csvContent += `\n--- CLASS SCHEDULED DATE: ${dateKey} ---\n`;
      csvContent += 'S.No,Student Name,Class/Batch,Subject/Meeting,Batch Timing Slot,Class Date,Submission Time\n';

      grouped11[dateKey].forEach((log, i) => {
        csvContent += [
          i + 1,
          `"${log.name.replace(/"/g, '""')}"`,
          `"${log.class.replace(/"/g, '""')}"`,
          `"${log.course.replace(/"/g, '""')}"`,
          `"${(log.timeSlot || '').replace(/"/g, '""')}"`,
          `"${dateKey}"`,
          `"${log.formattedDate.replace(/"/g, '""')}"`
        ].join(',') + '\n';
      });
    });
  }

  csvContent += '\n\n';

  // SECTION 2: CLASS 12TH ATTENDANCE (12 JEE & 12 NEET)
  csvContent += '========================================================================================\n';
  csvContent += '===                     CLASS 12TH ATTENDANCE LOGS (12 JEE & 12 NEET)                ===\n';
  csvContent += '========================================================================================\n';

  if (logs12.length === 0) {
    csvContent += '-,No Class 12th attendance records found,,,,,\n';
  } else {
    const grouped12 = groupLogsByDate(logs12);
    Object.keys(grouped12).forEach(dateKey => {
      csvContent += `\n--- CLASS SCHEDULED DATE: ${dateKey} ---\n`;
      csvContent += 'S.No,Student Name,Class/Batch,Subject/Meeting,Batch Timing Slot,Class Date,Submission Time\n';

      grouped12[dateKey].forEach((log, i) => {
        csvContent += [
          i + 1,
          `"${log.name.replace(/"/g, '""')}"`,
          `"${log.class.replace(/"/g, '""')}"`,
          `"${log.course.replace(/"/g, '""')}"`,
          `"${(log.timeSlot || '').replace(/"/g, '""')}"`,
          `"${dateKey}"`,
          `"${log.formattedDate.replace(/"/g, '""')}"`
        ].join(',') + '\n';
      });
    });
  }

  if (otherLogs.length > 0) {
    csvContent += '\n\n';
    csvContent += '========================================================================================\n';
    csvContent += '===                             OTHER ATTENDANCE LOGS                                ===\n';
    csvContent += '========================================================================================\n';

    const groupedOther = groupLogsByDate(otherLogs);
    Object.keys(groupedOther).forEach(dateKey => {
      csvContent += `\n--- CLASS SCHEDULED DATE: ${dateKey} ---\n`;
      csvContent += 'S.No,Student Name,Class/Batch,Subject/Meeting,Batch Timing Slot,Class Date,Submission Time\n';

      groupedOther[dateKey].forEach((log, i) => {
        csvContent += [
          i + 1,
          `"${log.name.replace(/"/g, '""')}"`,
          `"${log.class.replace(/"/g, '""')}"`,
          `"${log.course.replace(/"/g, '""')}"`,
          `"${(log.timeSlot || '').replace(/"/g, '""')}"`,
          `"${dateKey}"`,
          `"${log.formattedDate.replace(/"/g, '""')}"`
        ].join(',') + '\n';
      });
    });
  }

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `Attendance_Lakshya_2026_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast('Class 11 & Class 12 Attendance report downloaded!', 'fa-file-excel');
}

// Utility: HTML Escaper
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function(m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m];
  });
}

// Utility: Notification Toast
function showToast(msg, iconClass = 'fa-circle-info') {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMessage');
  const toastIcon = document.getElementById('toastIcon');

  toastMsg.innerText = msg;
  toastIcon.className = `fa-solid ${iconClass}`;
  
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3500);
}
