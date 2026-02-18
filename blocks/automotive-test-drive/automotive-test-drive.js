// State management
let selectedDay = null;
let selectedTime = null;
let currentStep = 1;

// eslint-disable-next-line no-unused-vars
function formatCurrency(amount) {
  return `$${amount.toLocaleString()}`;
}

function formatFullDate(day) {
  const dayNames = {
    Mon: 'Monday',
    Tue: 'Tuesday',
    Wed: 'Wednesday',
    Thu: 'Thursday',
    Fri: 'Friday',
    Sat: 'Saturday',
    Sun: 'Sunday',
  };
  return `${dayNames[day.day]} ${day.month} ${day.date}th, ${day.year}`;
}

function generateRandomAvailability(timeSlots) {
  return timeSlots.map((slot) => ({
    time: slot,
    available: Math.random() > 0.3,
  }));
}

function createVehicleHeader(vehicle) {
  const header = document.createElement('div');
  header.className = 'vehicle-header';

  const label = document.createElement('p');
  label.className = 'vehicle-interest-label';
  label.textContent = "You're interested in";

  const modelName = document.createElement('h2');
  modelName.className = 'vehicle-model-name';
  modelName.textContent = vehicle.model;

  header.appendChild(label);
  header.appendChild(modelName);

  return header;
}

function createLocationCard(dealership) {
  const card = document.createElement('div');
  card.className = 'location-card';

  const icon = document.createElement('span');
  icon.className = 'location-icon';
  icon.textContent = '\uD83D\uDCCD';

  const info = document.createElement('div');
  info.className = 'location-info';

  const name = document.createElement('h4');
  name.className = 'location-name';
  name.textContent = dealership.name;

  const address = document.createElement('p');
  address.className = 'location-address';
  address.textContent = dealership.address;

  info.appendChild(name);
  info.appendChild(address);
  card.appendChild(icon);
  card.appendChild(info);

  return card;
}

function createDaySelector(days, onSelect) {
  const container = document.createElement('div');
  container.className = 'day-selector-container';

  const selector = document.createElement('div');
  selector.className = 'day-selector';

  days.forEach((day, index) => {
    const dayBtn = document.createElement('button');
    dayBtn.className = 'day-btn';
    if (!day.available) dayBtn.classList.add('unavailable');
    if (index === 1) {
      dayBtn.classList.add('selected');
      selectedDay = day;
    }

    const dayName = document.createElement('span');
    dayName.className = 'day-name';
    dayName.textContent = day.day;

    const dayDate = document.createElement('span');
    dayDate.className = 'day-date';
    dayDate.textContent = day.date;

    dayBtn.appendChild(dayName);
    dayBtn.appendChild(dayDate);

    if (day.available) {
      dayBtn.addEventListener('click', () => {
        container.querySelectorAll('.day-btn').forEach((btn) => btn.classList.remove('selected'));
        dayBtn.classList.add('selected');
        selectedDay = day;
        onSelect(day);
      });
    }

    selector.appendChild(dayBtn);
  });

  const rightArrow = document.createElement('button');
  rightArrow.className = 'day-arrow';
  rightArrow.textContent = '\u203A';
  rightArrow.addEventListener('click', () => {
    selector.scrollBy({ left: 100, behavior: 'smooth' });
  });

  container.appendChild(selector);
  container.appendChild(rightArrow);

  return container;
}

function createDateDisplay() {
  const display = document.createElement('p');
  display.className = 'date-display';
  display.id = 'selected-date-display';
  if (selectedDay) {
    display.textContent = formatFullDate(selectedDay).toUpperCase();
  }
  return display;
}

function createTimeSlots(timeSlots, continueButton) {
  const container = document.createElement('div');
  container.className = 'time-slots-container';
  container.id = 'time-slots';

  const slots = generateRandomAvailability(timeSlots);

  slots.forEach((slot) => {
    const btn = document.createElement('button');
    btn.className = 'time-slot';
    if (!slot.available) btn.classList.add('unavailable');
    btn.textContent = slot.time;

    if (slot.available) {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.time-slot').forEach((s) => s.classList.remove('selected'));
        btn.classList.add('selected');
        selectedTime = slot.time;
        if (continueButton) {
          continueButton.disabled = false;
        }
      });
    }

    container.appendChild(btn);
  });

  return container;
}

function createStep1(data, onNext) {
  const step = document.createElement('div');
  step.className = 'wizard-step step-1';

  const headerLabel = document.createElement('p');
  headerLabel.className = 'step-header-label';
  headerLabel.textContent = 'REQUEST YOUR TEST DRIVE';

  const vehicleHeader = createVehicleHeader(data.vehicle);

  const title = document.createElement('h1');
  title.className = 'step-title';
  title.textContent = 'Pick a time and place.';

  const locationCard = createLocationCard(data.dealership);

  const continueBtn = document.createElement('button');
  continueBtn.className = 'submit-btn';
  continueBtn.id = 'continue-btn';
  continueBtn.textContent = 'Continue';
  continueBtn.disabled = true;
  continueBtn.addEventListener('click', () => {
    if (selectedDay && selectedTime) {
      onNext();
    }
  });

  const daySelector = createDaySelector(data.availableDays, (day) => {
    const dateDisplay = step.querySelector('.date-display');
    if (dateDisplay) {
      dateDisplay.textContent = formatFullDate(day).toUpperCase();
    }
    const timeSlotsContainer = step.querySelector('.time-slots-container');
    if (timeSlotsContainer) {
      const newTimeSlots = createTimeSlots(data.timeSlots, continueBtn);
      timeSlotsContainer.replaceWith(newTimeSlots);
      selectedTime = null;
      continueBtn.disabled = true;
    }
  });

  const dateDisplay = createDateDisplay();
  const dateLine = document.createElement('div');
  dateLine.className = 'date-line';

  const timeSlots = createTimeSlots(data.timeSlots, continueBtn);

  const note = document.createElement('p');
  note.className = 'test-drive-note';
  note.textContent = 'Your test drive will be approximately 30 mins. Please plan to arrive ten minutes before your test drive.';

  step.appendChild(headerLabel);
  step.appendChild(vehicleHeader);
  step.appendChild(title);
  step.appendChild(locationCard);
  step.appendChild(daySelector);
  step.appendChild(dateDisplay);
  step.appendChild(dateLine);
  step.appendChild(timeSlots);
  step.appendChild(note);
  step.appendChild(continueBtn);

  return step;
}

function generateConfirmationId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'CONF-';
  for (let i = 0; i < 8; i += 1) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

function createLoadingSpinner() {
  const container = document.createElement('div');
  container.className = 'loading-container';

  const spinner = document.createElement('div');
  spinner.className = 'spinner';

  const text = document.createElement('p');
  text.className = 'loading-text';
  text.textContent = 'Processing your request...';

  container.appendChild(spinner);
  container.appendChild(text);

  return container;
}

function createConfirmation(data, userInfo, confirmationId) {
  const container = document.createElement('div');
  container.className = 'confirmation-container';

  const icon = document.createElement('div');
  icon.className = 'confirmation-icon';
  icon.textContent = '\u2713';

  const title = document.createElement('h1');
  title.className = 'confirmation-title';
  title.textContent = 'Test Drive Confirmed!';

  const idLabel = document.createElement('p');
  idLabel.className = 'confirmation-id';
  idLabel.innerHTML = `Confirmation ID: <strong>${confirmationId}</strong>`;

  const detailsCard = document.createElement('div');
  detailsCard.className = 'details-card';

  const detailsLabel = document.createElement('p');
  detailsLabel.className = 'details-label';
  detailsLabel.textContent = 'YOUR TEST DRIVE';

  const vehicleName = document.createElement('h4');
  vehicleName.className = 'details-name';
  vehicleName.textContent = data.vehicle.model;

  const locationName = document.createElement('p');
  locationName.className = 'details-location';
  locationName.textContent = data.dealership.name;

  const locationAddress = document.createElement('p');
  locationAddress.className = 'details-address';
  locationAddress.textContent = data.dealership.address;

  const dateTime = document.createElement('p');
  dateTime.className = 'details-datetime';
  const formattedDate = selectedDay ? formatFullDate(selectedDay) : '';
  dateTime.textContent = `${formattedDate}, ${selectedTime || ''}`;

  detailsCard.appendChild(detailsLabel);
  detailsCard.appendChild(vehicleName);
  detailsCard.appendChild(locationName);
  detailsCard.appendChild(locationAddress);
  detailsCard.appendChild(dateTime);

  const userCard = document.createElement('div');
  userCard.className = 'details-card';

  const userLabel = document.createElement('p');
  userLabel.className = 'details-label';
  userLabel.textContent = 'DRIVER DETAILS';

  const userName = document.createElement('h4');
  userName.className = 'details-name';
  userName.textContent = `${userInfo.firstName} ${userInfo.lastName}`;

  const userEmail = document.createElement('p');
  userEmail.className = 'details-contact';
  userEmail.textContent = userInfo.email;

  const userPhone = document.createElement('p');
  userPhone.className = 'details-contact';
  userPhone.textContent = userInfo.phone;

  userCard.appendChild(userLabel);
  userCard.appendChild(userName);
  userCard.appendChild(userEmail);
  userCard.appendChild(userPhone);

  const confirmNote = document.createElement('p');
  confirmNote.className = 'confirmation-note';
  confirmNote.textContent = 'A confirmation email has been sent. Please arrive 10 minutes before your scheduled time.';

  container.appendChild(icon);
  container.appendChild(title);
  container.appendChild(idLabel);
  container.appendChild(detailsCard);
  container.appendChild(userCard);
  container.appendChild(confirmNote);

  return container;
}

function createStep2(data, onBack, block) {
  const step = document.createElement('div');
  step.className = 'wizard-step step-2';

  const backBtn = document.createElement('button');
  backBtn.className = 'back-btn';
  backBtn.innerHTML = '\u2190 Back';
  backBtn.addEventListener('click', onBack);

  const title = document.createElement('h1');
  title.className = 'step-title';
  title.textContent = "Let's get you on the road.";

  const detailsCard = document.createElement('div');
  detailsCard.className = 'details-card';

  const detailsLabel = document.createElement('p');
  detailsLabel.className = 'details-label';
  detailsLabel.textContent = 'TEST DRIVE DETAILS';

  const detailsName = document.createElement('h4');
  detailsName.className = 'details-name';
  detailsName.textContent = data.dealership.name;

  const detailsDateTime = document.createElement('p');
  detailsDateTime.className = 'details-datetime';
  const formattedDate = selectedDay ? formatFullDate(selectedDay) : '';
  detailsDateTime.textContent = `${formattedDate}, ${selectedTime || ''}`;

  detailsCard.appendChild(detailsLabel);
  detailsCard.appendChild(detailsName);
  detailsCard.appendChild(detailsDateTime);

  const formSection = document.createElement('div');
  formSection.className = 'form-section';

  const formTitle = document.createElement('h3');
  formTitle.className = 'form-title';
  formTitle.textContent = 'Driver Details';

  const form = document.createElement('form');
  form.className = 'driver-form';

  const fields = [
    { id: 'firstName', label: 'First Name', type: 'text' },
    { id: 'lastName', label: 'Last Name', type: 'text' },
    { id: 'email', label: 'Email Address', type: 'email' },
    { id: 'phone', label: 'Phone', type: 'tel' },
  ];

  fields.forEach((field) => {
    const fieldGroup = document.createElement('div');
    fieldGroup.className = 'form-field';

    const label = document.createElement('label');
    label.htmlFor = field.id;
    label.textContent = field.label;

    const input = document.createElement('input');
    input.type = field.type;
    input.id = field.id;
    input.name = field.id;
    input.required = true;

    fieldGroup.appendChild(label);
    fieldGroup.appendChild(input);
    form.appendChild(fieldGroup);
  });

  formSection.appendChild(formTitle);
  formSection.appendChild(form);

  const submitBtn = document.createElement('button');
  submitBtn.className = 'submit-btn';
  submitBtn.textContent = 'Request Your Test Drive';
  submitBtn.addEventListener('click', (e) => {
    e.preventDefault();

    const userInfo = {
      firstName: form.querySelector('#firstName').value || 'Guest',
      lastName: form.querySelector('#lastName').value || '',
      email: form.querySelector('#email').value || '',
      phone: form.querySelector('#phone').value || '',
    };

    block.innerHTML = '';
    block.appendChild(createLoadingSpinner());

    setTimeout(() => {
      const confirmationId = generateConfirmationId();
      block.innerHTML = '';
      block.appendChild(createConfirmation(data, userInfo, confirmationId));
    }, 3000);
  });

  step.appendChild(backBtn);
  step.appendChild(title);
  step.appendChild(detailsCard);
  step.appendChild(formSection);
  step.appendChild(submitBtn);

  return step;
}

function renderWizard(block, data) {
  block.innerHTML = '';

  if (currentStep === 1) {
    const step1 = createStep1(data, () => {
      currentStep = 2;
      renderWizard(block, data);
    });
    block.appendChild(step1);
  } else {
    const step2 = createStep2(data, () => {
      currentStep = 1;
      renderWizard(block, data);
    }, block);
    block.appendChild(step2);
  }
}

export default async function decorate(block, bridge) {
  block.textContent = 'Loading test drive booking...';
  block.className = 'automotive-test-drive';

  if (!bridge) {
    block.innerHTML = '<p style="padding:16px;color:#888;">This block requires tool data from an LLM Apps host.</p>';
    return;
  }

  // Theme support via bridge context changes
  bridge.onContextChange((ctx) => {
    if (ctx.theme) block.setAttribute('data-theme', ctx.theme);
  });

  // Set initial theme from host context
  const initialTheme = bridge.hostContext?.theme;
  block.setAttribute('data-theme', initialTheme || 'light');

  try {
    const result = await bridge.toolResult;
    const data = result?.structuredContent || result;

    if (!data) {
      block.innerHTML = '<p class="error-message">Unable to load test drive booking.</p>';
      return;
    }

    selectedDay = null;
    selectedTime = null;
    currentStep = 1;

    renderWizard(block, data);
  } catch (error) {
    block.textContent = 'Error loading test drive booking';
    // eslint-disable-next-line no-console
    console.error('Error loading test drive booking:', error);
  }
}
