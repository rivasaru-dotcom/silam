(() => {
"use strict";

const BOOKING_ENDPOINT = "https://script.google.com/macros/s/AKfycbwhkUxqA_g8QVPBF5asSxDhShY2jx85zSa9JUctePbj4VoXFWYQs4OtVCjSO_kCb3ZK6A/exec";
const TIMEZONE = "Australia/Sydney";

const BUSINESS_SLOTS = [
  "9:00 AM","9:30 AM","10:30 AM","11:00 AM",
  "1:00 PM","2:30 PM","3:30 PM","4:00 PM"
];
let availableTimes = [];

const $ = id => document.getElementById(id);
const els = {
  form:$("appointmentForm"), timeStep:$("timeStep"), detailsStep:$("detailsStep"), successStep:$("successStep"),
  dateStrip:$("dateStrip"), timeGrid:$("timeGrid"), monthLabel:$("monthLabel"), dateRangeLabel:$("dateRangeLabel"),
  selectedDateLabel:$("selectedDateLabel"), selectionSummary:$("selectionSummary"), detailsSlot:$("detailsSlot"),
  successSlot:$("successSlot"), successMessage:$("successMessage"), confirmationCode:$("confirmationCode"),
  continueBtn:$("continueBtn"), backBtn:$("backBtn"), submitBtn:$("submitBtn"), btnLabel:document.querySelector(".btn-label"),
  btnLoading:document.querySelector(".btn-loading"), liveAlert:$("liveAlert"), progressTime:$("progressTime"),
  progressDetails:$("progressDetails"), prevDays:$("prevDays"), nextDays:$("nextDays"), year:$("year")
};

let windowStart = startOfSydneyToday();
let visibleDates = [];
let selectedDate = null;
let selectedTime = null;

function fmt(options) {
  return new Intl.DateTimeFormat("en-AU", {timeZone:TIMEZONE, ...options});
}

function startOfSydneyToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone:TIMEZONE, year:"numeric", month:"2-digit", day:"2-digit"
  }).formatToParts(new Date());
  const v = Object.fromEntries(parts.map(p => [p.type,p.value]));
  return new Date(`${v.year}-${v.month}-${v.day}T00:00:00`);
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate()+n);
  return d;
}

function isoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

function isWeekday(date) {
  return date.getDay() !== 0 && date.getDay() !== 6;
}

function nextWeekdays(start, count) {
  const out = [];
  let d = new Date(start);
  while(out.length < count) {
    if(isWeekday(d)) out.push(new Date(d));
    d = addDays(d,1);
  }
  return out;
}

function longDate(date) {
  return fmt({weekday:"long",day:"numeric",month:"long"}).format(date);
}

function parts(date) {
  const p = fmt({weekday:"short",day:"numeric",month:"short"}).formatToParts(date);
  const m = Object.fromEntries(p.map(x => [x.type,x.value]));
  return {weekday:m.weekday.toUpperCase(),day:m.day,month:m.month};
}

function renderDates() {
  visibleDates = nextWeekdays(windowStart,5);
  els.dateStrip.innerHTML = "";

  visibleDates.forEach(date => {
    const p = parts(date);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "date-option";
    b.dataset.date = isoDate(date);
    b.innerHTML = `<span>${p.weekday}</span><strong>${p.day}</strong><small>${p.month}</small>`;
    if(selectedDate && isoDate(selectedDate) === isoDate(date)) b.classList.add("selected");
    b.addEventListener("click", () => {
      selectedDate = new Date(date);
      selectedTime = null;
      renderDates();
      renderTimes();
      updateSelection();
    });
    els.dateStrip.appendChild(b);
  });

  const first = visibleDates[0], last = visibleDates[4];
  els.monthLabel.textContent = new Intl.DateTimeFormat("en-AU",{month:"long",year:"numeric",timeZone:TIMEZONE}).format(first);
  els.dateRangeLabel.textContent = `${parts(first).day} ${parts(first).month} – ${parts(last).day} ${parts(last).month}`;
  els.prevDays.disabled = windowStart <= startOfSydneyToday();
}

function renderTimes() {
  els.timeGrid.innerHTML = "";
  if(!selectedDate) {
    els.selectedDateLabel.textContent = "Choose a date";
    return;
  }
  els.selectedDateLabel.textContent = longDate(selectedDate);

  BUSINESS_SLOTS.forEach(time => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "time-option";
    b.textContent = time;
    if(selectedTime === time) b.classList.add("selected");
    b.addEventListener("click", () => {
      selectedTime = time;
      renderTimes();
      updateSelection();
    });
    els.timeGrid.appendChild(b);
  });
}

function updateSelection() {
  const ready = selectedDate && selectedTime;
  if(!ready) {
    els.selectionSummary.textContent = "Choose a date and time";
    els.detailsSlot.textContent = "—";
    els.continueBtn.disabled = true;
    return;
  }
  const text = `${longDate(selectedDate)} · ${selectedTime}`;
  els.selectionSummary.textContent = text;
  els.detailsSlot.textContent = text;
  els.continueBtn.disabled = false;
}

function alertBox(message,type="error") {
  els.liveAlert.hidden = false;
  els.liveAlert.className = `booking-alert ${type}`;
  els.liveAlert.textContent = message;
}

function hideAlert() {
  els.liveAlert.hidden = true;
  els.liveAlert.textContent = "";
}

function goDetails() {
  if(!selectedDate || !selectedTime) return;
  hideAlert();
  els.timeStep.classList.add("d-none");
  els.detailsStep.classList.remove("d-none");
  els.progressTime.classList.remove("is-active");
  els.progressDetails.classList.add("is-active");
  $("firstName").focus();
}

function goTime() {
  hideAlert();
  els.detailsStep.classList.add("d-none");
  els.timeStep.classList.remove("d-none");
  els.progressDetails.classList.remove("is-active");
  els.progressTime.classList.add("is-active");
}

function setLoading(loading) {
  els.submitBtn.disabled = loading;
  els.btnLabel.hidden = loading;
  els.btnLoading.hidden = !loading;
}

async function submitBooking(e) {
  e.preventDefault();
  hideAlert();

  if(!selectedDate || !selectedTime) {
    goTime();
    alertBox("Please choose an appointment date and time.");
    return;
  }

  if(!els.form.checkValidity()) {
    els.form.classList.add("was-validated");
    alertBox("Please complete the required fields.");
    return;
  }

  setLoading(true);

  const data = new URLSearchParams();
  ["firstName","lastName","email","phone","reason","message"].forEach(id => {
    data.set(id, $(id).value.trim());
  });
  data.set("date", longDate(selectedDate));
  data.set("time", selectedTime);
  data.set("isoDate", isoDate(selectedDate));
  data.set("timezone", TIMEZONE);

  try {
    const response = await fetch(BOOKING_ENDPOINT, {
      method:"POST",
      body:data,
      redirect:"follow"
    });
    const text = await response.text();

    let result = null;
    try { result = JSON.parse(text); } catch (_) {
      const match = text.match(/postMessage\(\s*(\{[\s\S]*?\})\s*,/);
      if(match) { try { result = JSON.parse(match[1]); } catch (_) {} }
    }

    if(!result) throw new Error("Unexpected booking response.");

    if(!result.success) {
      alertBox(result.message || "That time is no longer available.");
      return;
    }

    els.detailsStep.classList.add("d-none");
    els.successStep.classList.remove("d-none");
    els.successSlot.textContent = `${longDate(selectedDate)} · ${selectedTime}`;
    const firstName = $("firstName").value.trim();
    els.successMessage.textContent = `Thanks${firstName ? `, ${firstName}` : ""}. Your consultation has been booked and a confirmation has been sent to your email.`;
    els.confirmationCode.textContent = result.confirmation ? `Confirmation: ${result.confirmation}` : "";
    window.scrollTo({top:0,behavior:"smooth"});
  } catch(err) {
    console.error(err);
    alertBox("We couldn't complete the booking right now. Please try again or contact SILAM Finance.");
  } finally {
    setLoading(false);
  }
}

els.prevDays.addEventListener("click", () => {
  const today = startOfSydneyToday();
  const candidate = addDays(windowStart,-5);
  windowStart = candidate < today ? today : candidate;
  selectedDate = null; selectedTime = null;
  renderDates(); renderTimes(); updateSelection();
});

els.nextDays.addEventListener("click", () => {
  windowStart = addDays(windowStart,5);
  selectedDate = null; selectedTime = null;
  renderDates(); renderTimes(); updateSelection();
});

els.continueBtn.addEventListener("click",goDetails);
els.backBtn.addEventListener("click",goTime);
els.form.addEventListener("submit",submitBooking);
els.year.textContent = new Date().getFullYear();

renderDates();
selectedDate = visibleDates[0];
renderDates();
renderTimes();
updateSelection();
})();