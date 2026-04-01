let selectedCafe = null;
let selectedDay = null;
let selectedTime = null;
let currentStep = 1;

function applyTheme(block, theme) {
  block.dataset.theme = (theme === 'dark') ? 'dark' : 'light';
}

function formatFullDate(day) {
  const dayNames = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };
  return `${dayNames[day.day]} ${day.month} ${day.date}, ${day.year}`;
}

function randomAvailability(slots) {
  return slots.map((t) => ({ time: t, available: Math.random() > 0.25 }));
}

function generateConfirmationId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'FCP-';
  for (let i = 0; i < 6; i += 1) id += chars.charAt(Math.floor(Math.random() * chars.length));
  return id;
}

function createCafeSelector(cafes, onSelect) {
  const container = document.createElement('div');
  container.className = 'ft-cafe-list';

  cafes.forEach((cafe, i) => {
    const card = document.createElement('button');
    card.className = 'ft-cafe-card';
    if (i === 0) { card.classList.add('selected'); selectedCafe = cafe; }

    const icon = document.createElement('span');
    icon.className = 'ft-cafe-icon';
    icon.textContent = '\u2615';

    const info = document.createElement('div');
    info.className = 'ft-cafe-info';

    const name = document.createElement('span');
    name.className = 'ft-cafe-name';
    name.textContent = cafe.name;

    const addr = document.createElement('span');
    addr.className = 'ft-cafe-addr';
    addr.textContent = cafe.address;

    info.appendChild(name);
    info.appendChild(addr);
    card.appendChild(icon);
    card.appendChild(info);

    card.addEventListener('click', () => {
      container.querySelectorAll('.ft-cafe-card').forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedCafe = cafe;
      onSelect(cafe);
    });

    container.appendChild(card);
  });

  return container;
}

function createTastingMenu(menu) {
  const container = document.createElement('div');
  container.className = 'ft-menu';

  const title = document.createElement('h3');
  title.className = 'ft-menu-title';
  title.textContent = 'Tasting Experiences';
  container.appendChild(title);

  menu.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'ft-menu-item';

    const name = document.createElement('span');
    name.className = 'ft-menu-name';
    name.textContent = item.name;

    const desc = document.createElement('span');
    desc.className = 'ft-menu-desc';
    desc.textContent = item.description;

    row.appendChild(name);
    row.appendChild(desc);
    container.appendChild(row);
  });

  return container;
}

function createDaySelector(days, onSelect) {
  const wrapper = document.createElement('div');
  wrapper.className = 'ft-day-wrapper';

  const selector = document.createElement('div');
  selector.className = 'ft-day-selector';

  days.forEach((day, i) => {
    const btn = document.createElement('button');
    btn.className = 'ft-day-btn';
    if (!day.available) btn.classList.add('unavailable');
    if (i === 0 && day.available) { btn.classList.add('selected'); selectedDay = day; }

    const dayName = document.createElement('span');
    dayName.className = 'ft-day-name';
    dayName.textContent = day.day;

    const dayDate = document.createElement('span');
    dayDate.className = 'ft-day-date';
    dayDate.textContent = day.date;

    btn.appendChild(dayName);
    btn.appendChild(dayDate);

    if (day.available) {
      btn.addEventListener('click', () => {
        selector.querySelectorAll('.ft-day-btn').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedDay = day;
        onSelect(day);
      });
    }

    selector.appendChild(btn);
  });

  wrapper.appendChild(selector);
  return wrapper;
}

function createTimeSlots(slots, continueBtn) {
  const container = document.createElement('div');
  container.className = 'ft-time-slots';

  const available = randomAvailability(slots);
  available.forEach((slot) => {
    const btn = document.createElement('button');
    btn.className = 'ft-time-btn';
    if (!slot.available) btn.classList.add('unavailable');
    btn.textContent = slot.time;

    if (slot.available) {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.ft-time-btn').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedTime = slot.time;
        if (continueBtn) continueBtn.disabled = false;
      });
    }
    container.appendChild(btn);
  });

  return container;
}

function createStep1(data, onNext) {
  const step = document.createElement('div');
  step.className = 'ft-step ft-step-1';

  const headerLabel = document.createElement('p');
  headerLabel.className = 'ft-header-label';
  headerLabel.textContent = 'BOOK A TASTING';

  const title = document.createElement('h1');
  title.className = 'ft-title';
  title.textContent = 'Reserve your Frescopa experience.';

  const subtitle = document.createElement('p');
  subtitle.className = 'ft-subtitle';
  subtitle.textContent = 'Find your nearest Frescopa café and book a tasting session.';

  const cafeSelector = createCafeSelector(data.cafes, () => {});
  const menu = createTastingMenu(data.tastingMenu);

  const dateLabel = document.createElement('h3');
  dateLabel.className = 'ft-section-label';
  dateLabel.textContent = 'Pick a date';

  const continueBtn = document.createElement('button');
  continueBtn.className = 'ft-submit-btn';
  continueBtn.textContent = 'Continue';
  continueBtn.disabled = true;
  continueBtn.addEventListener('click', () => { if (selectedCafe && selectedDay && selectedTime) onNext(); });

  const timeLabel = document.createElement('h3');
  timeLabel.className = 'ft-section-label';
  timeLabel.textContent = 'Pick a time';

  const timeSlots = createTimeSlots(data.timeSlots, continueBtn);

  const daySelector = createDaySelector(data.availableDays, () => {
    const oldSlots = step.querySelector('.ft-time-slots');
    if (oldSlots) {
      const newSlots = createTimeSlots(data.timeSlots, continueBtn);
      oldSlots.replaceWith(newSlots);
      selectedTime = null;
      continueBtn.disabled = true;
    }
  });

  const note = document.createElement('p');
  note.className = 'ft-note';
  note.textContent = 'Each tasting session lasts approximately 45 minutes. Complimentary for Frescopa members.';

  step.appendChild(headerLabel);
  step.appendChild(title);
  step.appendChild(subtitle);
  step.appendChild(cafeSelector);
  step.appendChild(menu);
  step.appendChild(dateLabel);
  step.appendChild(daySelector);
  step.appendChild(timeLabel);
  step.appendChild(timeSlots);
  step.appendChild(note);
  step.appendChild(continueBtn);

  return step;
}

function createStep2(data, onBack, block) {
  const step = document.createElement('div');
  step.className = 'ft-step ft-step-2';

  const backBtn = document.createElement('button');
  backBtn.className = 'ft-back-btn';
  backBtn.innerHTML = '\u2190 Back';
  backBtn.addEventListener('click', onBack);

  const title = document.createElement('h1');
  title.className = 'ft-title';
  title.textContent = 'Almost there.';

  const card = document.createElement('div');
  card.className = 'ft-details-card';

  const cardLabel = document.createElement('p');
  cardLabel.className = 'ft-details-label';
  cardLabel.textContent = 'YOUR TASTING';

  const cafeName = document.createElement('h4');
  cafeName.className = 'ft-details-name';
  cafeName.textContent = selectedCafe?.name || '';

  const cafeAddr = document.createElement('p');
  cafeAddr.className = 'ft-details-sub';
  cafeAddr.textContent = selectedCafe?.address || '';

  const dateTime = document.createElement('p');
  dateTime.className = 'ft-details-sub';
  dateTime.textContent = `${selectedDay ? formatFullDate(selectedDay) : ''}, ${selectedTime || ''}`;

  card.appendChild(cardLabel);
  card.appendChild(cafeName);
  card.appendChild(cafeAddr);
  card.appendChild(dateTime);

  const formTitle = document.createElement('h3');
  formTitle.className = 'ft-section-label';
  formTitle.textContent = 'Your details';

  const form = document.createElement('form');
  form.className = 'ft-form';

  [
    { id: 'ft-name', label: 'Full Name', type: 'text' },
    { id: 'ft-email', label: 'Email', type: 'email' },
    { id: 'ft-phone', label: 'Phone', type: 'tel' },
    { id: 'ft-guests', label: 'Number of Guests', type: 'number' },
  ].forEach((f) => {
    const group = document.createElement('div');
    group.className = 'ft-field';
    const label = document.createElement('label');
    label.htmlFor = f.id;
    label.textContent = f.label;
    const input = document.createElement('input');
    input.type = f.type;
    input.id = f.id;
    input.name = f.id;
    if (f.type === 'number') { input.min = '1'; input.max = '6'; input.value = '2'; }
    group.appendChild(label);
    group.appendChild(input);
    form.appendChild(group);
  });

  const submitBtn = document.createElement('button');
  submitBtn.className = 'ft-submit-btn';
  submitBtn.textContent = 'Reserve Tasting';
  submitBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const info = {
      name: form.querySelector('#ft-name')?.value || 'Guest',
      email: form.querySelector('#ft-email')?.value || '',
      phone: form.querySelector('#ft-phone')?.value || '',
      guests: form.querySelector('#ft-guests')?.value || '2',
    };

    block.innerHTML = '';
    const spinner = document.createElement('div');
    spinner.className = 'ft-loading';
    spinner.innerHTML = '<div class="ft-spinner"></div><p>Reserving your tasting...</p>';
    block.appendChild(spinner);

    setTimeout(() => {
      block.innerHTML = '';
      block.appendChild(createConfirmation(info));
    }, 2500);
  });

  step.appendChild(backBtn);
  step.appendChild(title);
  step.appendChild(card);
  step.appendChild(formTitle);
  step.appendChild(form);
  step.appendChild(submitBtn);

  return step;
}

function createConfirmation(userInfo) {
  const container = document.createElement('div');
  container.className = 'ft-confirmation';

  const icon = document.createElement('div');
  icon.className = 'ft-confirm-icon';
  icon.textContent = '\u2713';

  const title = document.createElement('h1');
  title.className = 'ft-confirm-title';
  title.textContent = 'Tasting Reserved!';

  const confId = document.createElement('p');
  confId.className = 'ft-confirm-id';
  confId.innerHTML = `Confirmation: <strong>${generateConfirmationId()}</strong>`;

  const card = document.createElement('div');
  card.className = 'ft-details-card';

  const label1 = document.createElement('p');
  label1.className = 'ft-details-label';
  label1.textContent = 'YOUR TASTING';
  const name1 = document.createElement('h4');
  name1.className = 'ft-details-name';
  name1.textContent = selectedCafe?.name || '';
  const sub1 = document.createElement('p');
  sub1.className = 'ft-details-sub';
  sub1.textContent = selectedCafe?.address || '';
  const sub2 = document.createElement('p');
  sub2.className = 'ft-details-sub';
  sub2.textContent = `${selectedDay ? formatFullDate(selectedDay) : ''}, ${selectedTime || ''}`;

  card.appendChild(label1);
  card.appendChild(name1);
  card.appendChild(sub1);
  card.appendChild(sub2);

  const card2 = document.createElement('div');
  card2.className = 'ft-details-card';
  const label2 = document.createElement('p');
  label2.className = 'ft-details-label';
  label2.textContent = 'GUEST DETAILS';
  const name2 = document.createElement('h4');
  name2.className = 'ft-details-name';
  name2.textContent = userInfo.name;
  const sub3 = document.createElement('p');
  sub3.className = 'ft-details-sub';
  sub3.textContent = `${userInfo.email} · ${userInfo.guests} guest${userInfo.guests > 1 ? 's' : ''}`;

  card2.appendChild(label2);
  card2.appendChild(name2);
  card2.appendChild(sub3);

  const note = document.createElement('p');
  note.className = 'ft-confirm-note';
  note.textContent = 'A confirmation email has been sent. See you at the café!';

  container.appendChild(icon);
  container.appendChild(title);
  container.appendChild(confId);
  container.appendChild(card);
  container.appendChild(card2);
  container.appendChild(note);

  return container;
}

function renderWizard(block, data) {
  block.innerHTML = '';
  if (currentStep === 1) {
    block.appendChild(createStep1(data, () => { currentStep = 2; renderWizard(block, data); }));
  } else {
    block.appendChild(createStep2(data, () => { currentStep = 1; renderWizard(block, data); }, block));
  }
}

export default async function decorate(block, bridge) {
  block.textContent = 'Finding nearby tastings...';
  block.className = 'frescopa-tasting';

  if (!bridge) {
    block.innerHTML = '<p class="ft-empty">This block requires tool data from an LLM Apps host.</p>';
    return;
  }

  applyTheme(block, bridge.hostContext?.theme);
  bridge.onContextChange((ctx) => { if (ctx.theme) applyTheme(block, ctx.theme); });

  try {
    const result = await bridge.toolResult;
    const data = result?.structuredContent || result;

    if (!data || !data.cafes) {
      block.innerHTML = '<p class="ft-empty">No cafés found nearby.</p>';
      return;
    }

    selectedCafe = null;
    selectedDay = null;
    selectedTime = null;
    currentStep = 1;
    renderWizard(block, data);
  } catch (error) {
    block.textContent = 'Error loading tasting sessions';
    // eslint-disable-next-line no-console
    console.error('Error loading tasting booking:', error);
  }
}
