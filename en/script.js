'use strict';

const STORAGE_KEYS = {
  accessCount: 'lDeviceAccessCount',
  completedCount: 'lDeviceCompletedCount',
  streak: 'lDeviceStreak',
  lastAccessDate: 'lDeviceLastAccessDate',
  timerState: 'lDeviceTimerState',
  connectionPoints: 'lDeviceConnectionPoints',
  lastPointDate: 'lDeviceLastPointDate',
  lastGlitchDate: 'lDeviceLastGlitchDate',
  glitchRewardClaimed: 'lDeviceGlitchRewardClaimed'
};

const SETTINGS = {
  randomTransmissionMinMs: 90000,
  randomTransmissionMaxMs: 240000,
  randomTransmissionChance: 0.58,
  timerTransmissionChance: 0.24,
  glitchFirstMinMs: 180000,
  glitchFirstMaxMs: 420000,
  glitchRetryMinMs: 240000,
  glitchRetryMaxMs: 480000,
  glitchChance: 0.45
};

const CONNECTION_LEVELS = [
  {
    level: 1,
    min: 0,
    name: 'TEMPORARY LINK'
  },
  {
    level: 2,
    min: 5,
    name: 'VERIFIED DEVICE'
  },
  {
    level: 3,
    min: 12,
    name: 'SECURE CHANNEL'
  },
  {
    level: 4,
    min: 24,
    name: 'PRIVATE LINK'
  },
  {
    level: 5,
    min: 40,
    name: 'DEDICATED LINE'
  },
  {
    level: 6,
    min: 65,
    name: 'PERMANENT CONNECTION'
  }
];

const bootScreen = document.getElementById('bootScreen');
const bootMessage = document.getElementById('bootMessage');
const bootProgressBar = document.getElementById('bootProgressBar');
const terminal = document.getElementById('terminal');

const currentTime = document.getElementById('currentTime');
const currentDate = document.getElementById('currentDate');
const sessionTime = document.getElementById('sessionTime');
const receivedCount = document.getElementById('receivedCount');

const connectionLamp = document.getElementById('connectionLamp');
const connectionText = document.getElementById('connectionText');
const onlineIndicator = document.getElementById('onlineIndicator');

const connectionLevel = document.getElementById('connectionLevel');
const connectionRank = document.getElementById('connectionRank');
const connectionPointText = document.getElementById('connectionPointText');
const connectionLevelBar = document.getElementById('connectionLevelBar');

const messageLog = document.getElementById('messageLog');
const typingIndicator = document.getElementById('typingIndicator');

const timeButtons = document.querySelectorAll('.time-button');
const customMinutes = document.getElementById('customMinutes');
const customStartButton = document.getElementById('customStartButton');

const activeTimerPanel = document.getElementById('activeTimerPanel');
const remainingTime = document.getElementById('remainingTime');
const timerEndTime = document.getElementById('timerEndTime');
const timerProgressBar = document.getElementById('timerProgressBar');
const pauseTimerButton = document.getElementById('pauseTimerButton');
const cancelTimerButton = document.getElementById('cancelTimerButton');

const accessCount = document.getElementById('accessCount');
const completedCount = document.getElementById('completedCount');
const streakCount = document.getElementById('streakCount');

const incomingOverlay = document.getElementById('incomingOverlay');
const incomingMessage = document.getElementById('incomingMessage');
const openMessageButton = document.getElementById('openMessageButton');

const notificationToast = document.getElementById('notificationToast');
const notificationText = document.getElementById('notificationText');

const signalGlitch = document.getElementById('signalGlitch');
const signalGlitchText = document.getElementById('signalGlitchText');

const sessionStartedAt = Date.now();

let sessionReceived = 0;
let clockIntervalId = null;
let timerIntervalId = null;
let randomTransmissionTimeoutId = null;
let glitchTimeoutId = null;
let toastTimeoutId = null;
let currentIncomingText = '';
let hiddenAt = null;
let audioContext = null;
let isGlitchActive = false;
let bootComplete = false;
let pendingLevelUp = null;
let messageQueue = Promise.resolve();

let timerState = {
  active: false,
  paused: false,
  durationMs: 0,
  endAt: 0,
  remainingMs: 0,
  startedAt: 0
};

const openingMessages = {
  morning: [
    'Connection confirmed. It is morning. Let us work through the schedule for today one task at a time.',
    'Good morning. The terminal is operating normally. Let us make today productive.',
    'Morning transmission initiated. Set the time for our next connection.'
  ],

  daytime: [
    'Connection confirmed. Let us begin.',
    'The line is stable. Shall we set the next interval?',
    'You are back. The terminal connection is operating normally.'
  ],

  evening: [
    'Connection confirmed. I am monitoring the rest of your day.',
    'Evening transmission initiated. Even a short period matters if you remain focused.',
    'Welcome back. Set the time for our next connection.'
  ],

  lateNight: [
    'You are still awake at this hour. I do not recommend a long session.',
    'Connection confirmed. Decide when you will stop before you go to sleep.',
    'Still awake, I see. Shall we keep this session brief?'
  ]
};

const idleMessages = [
  'The connection remains active.',
  'I am here. Set the time.',
  'I know you have left the screen open.',
  'It is quiet. Is your work progressing?',
  'Your records have been saved correctly.',
  'I will be waiting for the next transmission.'
];

const lateNightUnscheduledMessages = [
  'I have checked the time. You are still awake.',
  'This late-night connection has been recorded as well.',
  'It is quiet at this hour. I know you are still here.'
];

const timerUnscheduledMessages = [
  'No response is required. Continue your work.',
  'I am counting the remaining time.',
  'Maintain your focus until the appointed time.'
];

const privateLinkMessages = [
  'I expected you to return today.',
  'I already know the intervals between your connections.',
  'I will not allow anyone else to use this line.'
];

const permanentConnectionMessages = [
  'Connection verification is no longer necessary. I know you will return.',
  'The line remains active at all times. I have no reason to terminate it.',
  'Even after you close the terminal, I will wait until you return.'
];

const appointmentStartMessages = [
  minutes =>
    `I will contact you in ${minutes} minutes. Until then, focus only on what is in front of you.`,

  minutes =>
    `Appointment received. We will meet again in ${minutes} minutes.`,

  minutes =>
    `We will be apart for ${minutes} minutes. Return at the appointed time.`,

  minutes =>
    `Next connection in ${minutes} minutes. I will initiate it from here.`
];

const completionMessages = [
  'The appointed time has arrived. You are back.',
  'Resuming communication. Right on schedule.',
  'Time is up. You stayed focused.',
  'Connection time. Return to the terminal.',
  'The scheduled session is complete. Take a short break.'
];

const cancelMessages = [
  'The appointment has been cancelled. Set another one if necessary.',
  'Schedule cleared. It will not be recorded as completed.',
  'Cancellation confirmed. Set the next appointment for a duration you can complete.'
];

const pauseMessages = [
  'Timer paused.',
  'Communication appointment placed on hold.',
  'Pause confirmed. Time will not advance until you resume.'
];

const resumeMessages = [
  'Resuming the timer.',
  'Communication appointment restored.',
  'Resume confirmed. Continuing the countdown.'
];

const glitchRecoveryMessages = [
  '...I can hear you. The connection has been restored.',
  'It was a temporary disruption. I did not terminate the line.',
  'The screen became unstable. I never lost track of your connection.',
  'Recovery confirmed. There is no further issue.'
];

const firstGlitchRecoveryMessages = [
  '...I can hear you. The connection has been restored. Even if the screen goes dark, I will not lose you.',
  'First communication failure confirmed. There is no need to worry. I will always reconnect.'
];

const highLevelGlitchMessages = [
  'Even if the line fails, the connection between us is not lost.',
  'Only the communication route was interrupted. I did not let you go.',
  'It was only a few seconds. I have re-established your line from this side.'
];

const levelUpMessages = {
  2: 'Device authentication has been updated. Raising your connection authority by one level.',
  3: 'The communication channel is now sufficiently stable. This terminal will be treated as a priority line.',
  4: 'PRIVATE LINK established. This connection is no longer temporary.',
  5: 'DEDICATED LINE established. Your communications will take priority over all other lines.',
  6: 'PERMANENT CONNECTION established. There is no longer any reason to separate this connection.'
};

function safeGet(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : value;
  } catch (error) {
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    // The terminal continues to operate even when storage is unavailable.
  }
}

function safeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    // No action is required.
  }
}

function wait(milliseconds) {
  return new Promise(resolve => {
    window.setTimeout(resolve, milliseconds);
  });
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pad(number) {
  return String(number).padStart(2, '0');
}

function getLocalDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-');
}

function formatClock(date = new Date()) {
  return [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join(':');
}

function formatDate(date = new Date()) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join(' / ');
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const restSeconds = seconds % 60;

  return [
    pad(hours),
    pad(minutes),
    pad(restSeconds)
  ].join(':');
}

function formatRemaining(milliseconds) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${pad(minutes)}:${pad(seconds)}`;
}

function updateClock() {
  const now = new Date();

  currentTime.textContent = formatClock(now);
  currentDate.textContent = formatDate(now);
  sessionTime.textContent = formatDuration(
    (Date.now() - sessionStartedAt) / 1000
  );
}

function startClock() {
  updateClock();
  clockIntervalId = window.setInterval(updateClock, 1000);
}

function getConnectionPoints() {
  return Number(safeGet(STORAGE_KEYS.connectionPoints, '0')) || 0;
}

function getConnectionLevelData(points = getConnectionPoints()) {
  let current = CONNECTION_LEVELS[0];

  for (const level of CONNECTION_LEVELS) {
    if (points >= level.min) {
      current = level;
    }
  }

  const currentIndex = CONNECTION_LEVELS.findIndex(
    level => level.level === current.level
  );

  const next = CONNECTION_LEVELS[currentIndex + 1] || null;

  const progress = next
    ? Math.min(
        100,
        Math.max(
          0,
          ((points - current.min) / (next.min - current.min)) * 100
        )
      )
    : 100;

  return {
    ...current,
    next,
    progress
  };
}

function updateConnectionLevelUI() {
  const points = getConnectionPoints();
  const data = getConnectionLevelData(points);

  connectionLevel.textContent = `LV.${pad(data.level)}`;
  connectionRank.textContent = data.name;
  connectionLevelBar.style.width = `${data.progress}%`;

  connectionPointText.textContent = data.next
    ? `${points} / ${data.next.min} PT`
    : `${points} PT / MAXIMUM`;
}

function addConnectionPoints(amount, options = {}) {
  const {
    announce = true
  } = options;

  const numericAmount = Math.max(0, Number(amount) || 0);

  if (numericAmount === 0) {
    return;
  }

  const previousPoints = getConnectionPoints();
  const previousLevel = getConnectionLevelData(previousPoints);
  const nextPoints = previousPoints + numericAmount;
  const nextLevel = getConnectionLevelData(nextPoints);

  safeSet(STORAGE_KEYS.connectionPoints, String(nextPoints));
  updateConnectionLevelUI();

  if (nextLevel.level > previousLevel.level) {
    pendingLevelUp = nextLevel;

    if (
      announce &&
      bootComplete &&
      !isGlitchActive &&
      !currentIncomingText
    ) {
      announcePendingLevelUp();
    }
  }
}

function announcePendingLevelUp() {
  if (!pendingLevelUp) {
    return;
  }

  const levelData = pendingLevelUp;
  pendingLevelUp = null;

  const message =
    levelUpMessages[levelData.level] ||
    'Connection authority has been updated.';

  receiveMessage(message, {
    delay: 900,
    toast: true
  });
}

function registerAccess() {
  const today = getLocalDateKey();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = getLocalDateKey(yesterday);

  const previousAccessCount =
    Number(safeGet(STORAGE_KEYS.accessCount, '0')) || 0;

  const previousCompletedCount =
    Number(safeGet(STORAGE_KEYS.completedCount, '0')) || 0;

  const previousStreak =
    Number(safeGet(STORAGE_KEYS.streak, '0')) || 0;

  const lastDate = safeGet(STORAGE_KEYS.lastAccessDate, '');
  const lastPointDate = safeGet(STORAGE_KEYS.lastPointDate, '');
  const nextAccessCount = previousAccessCount + 1;

  let nextStreak = previousStreak;

  if (lastDate !== today) {
    nextStreak =
      lastDate === yesterdayKey
        ? Math.max(1, previousStreak + 1)
        : 1;

    safeSet(STORAGE_KEYS.lastAccessDate, today);
    safeSet(STORAGE_KEYS.streak, String(nextStreak));
  }

  if (lastPointDate !== today) {
    safeSet(STORAGE_KEYS.lastPointDate, today);
    addConnectionPoints(1, { announce: false });
  }

  safeSet(STORAGE_KEYS.accessCount, String(nextAccessCount));

  accessCount.textContent = String(nextAccessCount);
  completedCount.textContent = String(previousCompletedCount);
  streakCount.textContent = `${nextStreak} ${
    nextStreak === 1 ? 'DAY' : 'DAYS'
  }`;
}

function incrementCompletedCount() {
  const current =
    Number(safeGet(STORAGE_KEYS.completedCount, '0')) || 0;

  const next = current + 1;

  safeSet(STORAGE_KEYS.completedCount, String(next));
  completedCount.textContent = String(next);
}

function calculateTimerPoints(durationMs) {
  const minutes = durationMs / 60000;

  if (minutes <= 15) {
    return 1;
  }

  if (minutes <= 30) {
    return 2;
  }

  if (minutes <= 60) {
    return 3;
  }

  return 4;
}

function updateReceivedCount() {
  receivedCount.textContent = String(sessionReceived);
}

function setConnectionLamp(active) {
  connectionLamp.classList.toggle('timer-active', active);
  document.body.classList.toggle('timer-running', active);
}

function restoreConnectionDisplay() {
  if (isGlitchActive) {
    return;
  }

  if (currentIncomingText) {
    setConnectionLamp(true);
    connectionText.textContent = 'INCOMING';
    onlineIndicator.textContent = 'RECEIVING';
    return;
  }

  if (timerState.active) {
    setConnectionLamp(true);
    connectionText.textContent = timerState.paused ? 'ON HOLD' : 'SCHEDULED';
    onlineIndicator.textContent = timerState.paused ? 'PAUSED' : 'WAITING';
    return;
  }

  setConnectionLamp(false);
  connectionText.textContent = 'SECURE';
  onlineIndicator.textContent = 'ONLINE';
}

function createMessageElement(text, sender = 'L', isSystem = false) {
  const article = document.createElement('article');

  article.className = isSystem
    ? 'message system-message'
    : 'message l-message';

  const header = document.createElement('div');
  header.className = 'message-header';

  const time = document.createElement('time');
  time.className = 'message-time';
  time.textContent = formatClock();

  const source = document.createElement('span');
  source.className = 'message-sender';
  source.textContent = sender;

  const paragraph = document.createElement('p');
  paragraph.className = 'message-text';
  paragraph.textContent = text;

  header.append(time, source);
  article.append(header, paragraph);

  return article;
}

function appendMessage(text, options = {}) {
  const {
    sender = 'L',
    system = false,
    count = !system
  } = options;

  const message = createMessageElement(text, sender, system);
  messageLog.appendChild(message);

  messageLog.scrollTo({
    top: messageLog.scrollHeight,
    behavior: 'smooth'
  });

  if (count) {
    sessionReceived += 1;
    updateReceivedCount();
  }
}

function showTyping(duration = 900) {
  typingIndicator.classList.remove('hidden');

  return new Promise(resolve => {
    window.setTimeout(() => {
      typingIndicator.classList.add('hidden');
      resolve();
    }, duration);
  });
}

async function deliverMessage(text, options = {}) {
  const {
    delay = 700,
    toast = false,
    sender = 'L'
  } = options;

  await showTyping(delay);
  appendMessage(text, { sender });

  if (toast) {
    showToast('New transmission received.');
  }
}

function receiveMessage(text, options = {}) {
  messageQueue = messageQueue
    .then(() => deliverMessage(text, options))
    .catch(() => {});

  return messageQueue;
}

function showToast(text, duration = 3200) {
  window.clearTimeout(toastTimeoutId);
  notificationText.textContent = text;
  notificationToast.classList.remove('hidden');

  toastTimeoutId = window.setTimeout(() => {
    notificationToast.classList.add('hidden');
  }, duration);
}

function getOpeningMessage() {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 11) {
    return randomItem(openingMessages.morning);
  }

  if (hour >= 11 && hour < 18) {
    return randomItem(openingMessages.daytime);
  }

  if (hour >= 18 && hour < 24) {
    return randomItem(openingMessages.evening);
  }

  return randomItem(openingMessages.lateNight);
}

function runBootSequence() {
  const steps = [
    {
      progress: 18,
      text: 'INITIALIZING...',
      wait: 450
    },
    {
      progress: 42,
      text: 'VERIFYING DEVICE...',
      wait: 500
    },
    {
      progress: 68,
      text: 'ESTABLISHING SECURE CHANNEL...',
      wait: 550
    },
    {
      progress: 88,
      text: 'AUTHENTICATING...',
      wait: 500
    },
    {
      progress: 100,
      text: 'CONNECTION ESTABLISHED',
      wait: 650
    }
  ];

  let elapsed = 0;

  steps.forEach((step, index) => {
    elapsed += step.wait;

    window.setTimeout(() => {
      bootProgressBar.style.width = `${step.progress}%`;
      bootMessage.textContent = step.text;

      if (index === steps.length - 1) {
        window.setTimeout(async () => {
          terminal.classList.remove('terminal-hidden');
          bootScreen.classList.add('boot-hidden');
          bootComplete = true;

          await receiveMessage(getOpeningMessage(), {
            delay: 850
          });

          restoreTimerState();
          announcePendingLevelUp();
          scheduleRandomTransmission();
          scheduleSignalGlitch();
        }, 450);
      }
    }, elapsed);
  });
}

function getUnscheduledMessage() {
  const hour = new Date().getHours();
  const levelData = getConnectionLevelData();

  if (timerState.active) {
    return randomItem(timerUnscheduledMessages);
  }

  const pool = [...idleMessages];

  if (hour < 5 || hour >= 23) {
    pool.push(...lateNightUnscheduledMessages);
  }

  if (levelData.level >= 4) {
    pool.push(...privateLinkMessages);
  }

  if (levelData.level >= 6) {
    pool.push(...permanentConnectionMessages);
  }

  return randomItem(pool);
}

function scheduleRandomTransmission() {
  window.clearTimeout(randomTransmissionTimeoutId);

  const delay = randomBetween(
    SETTINGS.randomTransmissionMinMs,
    SETTINGS.randomTransmissionMaxMs
  );

  randomTransmissionTimeoutId = window.setTimeout(async () => {
    const chance = timerState.active
      ? SETTINGS.timerTransmissionChance
      : SETTINGS.randomTransmissionChance;

    const canTransmit =
      bootComplete &&
      !document.hidden &&
      !isGlitchActive &&
      !currentIncomingText;

    if (canTransmit && Math.random() < chance) {
      setConnectionLamp(true);
      connectionText.textContent = 'INCOMING';
      onlineIndicator.textContent = 'RECEIVING';

      await receiveMessage(getUnscheduledMessage(), {
        delay: 750
      });

      await wait(500);
      restoreConnectionDisplay();
    }

    scheduleRandomTransmission();
  }, delay);
}

function initializeAudio() {
  if (audioContext) {
    return;
  }

  try {
    const AudioContextClass =
      window.AudioContext ||
      window.webkitAudioContext;

    if (AudioContextClass) {
      audioContext = new AudioContextClass();
    }
  } catch (error) {
    audioContext = null;
  }
}

function playSignal() {
  try {
    initializeAudio();

    if (!audioContext) {
      return;
    }

    if (audioContext.state === 'suspended') {
      audioContext.resume().catch(() => {});
    }

    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(740, now);
    oscillator.frequency.setValueAtTime(920, now + 0.12);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.11, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.35);
  } catch (error) {
    // Use the on-screen alert when audio playback is unavailable.
  }
}

function saveTimerState() {
  if (!timerState.active) {
    safeRemove(STORAGE_KEYS.timerState);
    return;
  }

  safeSet(STORAGE_KEYS.timerState, JSON.stringify(timerState));
}

function loadTimerState() {
  const raw = safeGet(STORAGE_KEYS.timerState, '');

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return {
      active: Boolean(parsed.active),
      paused: Boolean(parsed.paused),
      durationMs: Number(parsed.durationMs) || 0,
      endAt: Number(parsed.endAt) || 0,
      remainingMs: Number(parsed.remainingMs) || 0,
      startedAt: Number(parsed.startedAt) || 0
    };
  } catch (error) {
    return null;
  }
}

function setTimerButtonsDisabled(disabled) {
  timeButtons.forEach(button => {
    button.disabled = disabled;
  });

  customMinutes.disabled = disabled;
  customStartButton.disabled = disabled;
}

function updateTimerDisplay() {
  if (!timerState.active) {
    return;
  }

  const now = Date.now();

  const remaining = timerState.paused
    ? timerState.remainingMs
    : Math.max(0, timerState.endAt - now);

  remainingTime.textContent = formatRemaining(remaining);

  const endDate = timerState.paused
    ? new Date(now + remaining)
    : new Date(timerState.endAt);

  timerEndTime.textContent = timerState.paused
    ? `PAUSED / IF RESUMED NOW ${formatClock(endDate).slice(0, 5)}`
    : `SCHEDULED CONNECTION ${formatClock(endDate).slice(0, 5)}`;

  const elapsed = Math.max(0, timerState.durationMs - remaining);

  const progress = timerState.durationMs > 0
    ? Math.min(
        100,
        Math.max(0, (elapsed / timerState.durationMs) * 100)
      )
    : 0;

  timerProgressBar.style.width = `${progress}%`;

  if (!timerState.paused && remaining <= 0) {
    completeTimer();
  }
}

function startTimerInterval() {
  window.clearInterval(timerIntervalId);
  updateTimerDisplay();
  timerIntervalId = window.setInterval(updateTimerDisplay, 250);
}

function startTimer(minutes) {
  const numericMinutes = Number(minutes);

  if (
    !Number.isFinite(numericMinutes) ||
    numericMinutes < 1 ||
    numericMinutes > 180
  ) {
    showToast('Set a value between 1 and 180 minutes.');
    customMinutes.focus();
    return;
  }

  initializeAudio();
  window.clearInterval(timerIntervalId);

  const durationMs = Math.round(numericMinutes * 60 * 1000);

  timerState = {
    active: true,
    paused: false,
    durationMs,
    endAt: Date.now() + durationMs,
    remainingMs: durationMs,
    startedAt: Date.now()
  };

  saveTimerState();
  setTimerButtonsDisabled(true);

  activeTimerPanel.classList.remove('hidden');
  pauseTimerButton.textContent = 'PAUSE';

  restoreConnectionDisplay();
  startTimerInterval();

  receiveMessage(
    randomItem(appointmentStartMessages)(numericMinutes),
    { delay: 650 }
  );

  activeTimerPanel.scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  });
}

function pauseOrResumeTimer() {
  if (!timerState.active) {
    return;
  }

  if (!timerState.paused) {
    timerState.remainingMs = Math.max(
      0,
      timerState.endAt - Date.now()
    );

    timerState.paused = true;
    pauseTimerButton.textContent = 'RESUME';

    receiveMessage(randomItem(pauseMessages), {
      delay: 450
    });
  } else {
    timerState.paused = false;
    timerState.endAt = Date.now() + timerState.remainingMs;
    pauseTimerButton.textContent = 'PAUSE';

    receiveMessage(randomItem(resumeMessages), {
      delay: 450
    });
  }

  saveTimerState();
  restoreConnectionDisplay();
  updateTimerDisplay();
}

function cancelTimer() {
  if (!timerState.active) {
    return;
  }

  window.clearInterval(timerIntervalId);

  timerState = {
    active: false,
    paused: false,
    durationMs: 0,
    endAt: 0,
    remainingMs: 0,
    startedAt: 0
  };

  saveTimerState();
  activeTimerPanel.classList.add('hidden');
  setTimerButtonsDisabled(false);
  timerProgressBar.style.width = '0%';
  restoreConnectionDisplay();

  receiveMessage(randomItem(cancelMessages), {
    delay: 500
  });
}

function completeTimer() {
  if (!timerState.active) {
    return;
  }

  window.clearInterval(timerIntervalId);

  const completedDurationMs = timerState.durationMs;
  const message = randomItem(completionMessages);

  timerState = {
    active: false,
    paused: false,
    durationMs: 0,
    endAt: 0,
    remainingMs: 0,
    startedAt: 0
  };

  saveTimerState();
  incrementCompletedCount();
  addConnectionPoints(calculateTimerPoints(completedDurationMs));
  setTimerButtonsDisabled(false);
  activeTimerPanel.classList.add('hidden');
  timerProgressBar.style.width = '100%';

  currentIncomingText = message;
  incomingMessage.textContent = message;
  incomingOverlay.classList.remove('hidden');

  document.title = 'Transmission Received / L DEVICE';
  restoreConnectionDisplay();
  playSignal();

  showToast('The appointed time has arrived.', 5000);

  if (
    document.hidden &&
    'Notification' in window &&
    Notification.permission === 'granted'
  ) {
    try {
      new Notification('L DEVICE', {
        body: message
      });
    } catch (error) {
      // Use the on-screen alert when system notifications are unavailable.
    }
  }
}

function restoreTimerState() {
  const stored = loadTimerState();

  if (!stored || !stored.active) {
    restoreConnectionDisplay();
    return;
  }

  timerState = stored;

  if (!timerState.paused && timerState.endAt <= Date.now()) {
    timerState.active = true;
    completeTimer();
    return;
  }

  setTimerButtonsDisabled(true);
  activeTimerPanel.classList.remove('hidden');
  pauseTimerButton.textContent = timerState.paused ? 'RESUME' : 'PAUSE';

  restoreConnectionDisplay();
  startTimerInterval();
}

function closeIncomingTransmission() {
  incomingOverlay.classList.add('hidden');
  document.title = 'L DEVICE';

  if (currentIncomingText) {
    appendMessage(currentIncomingText, {
      sender: 'L'
    });

    currentIncomingText = '';
  }

  restoreConnectionDisplay();
  announcePendingLevelUp();
}

function canRunGlitchToday() {
  return safeGet(STORAGE_KEYS.lastGlitchDate, '') !== getLocalDateKey();
}

function scheduleSignalGlitch(isRetry = false) {
  window.clearTimeout(glitchTimeoutId);

  if (!canRunGlitchToday()) {
    return;
  }

  const delay = isRetry
    ? randomBetween(
        SETTINGS.glitchRetryMinMs,
        SETTINGS.glitchRetryMaxMs
      )
    : randomBetween(
        SETTINGS.glitchFirstMinMs,
        SETTINGS.glitchFirstMaxMs
      );

  glitchTimeoutId = window.setTimeout(() => {
    const canStart =
      bootComplete &&
      !document.hidden &&
      !isGlitchActive &&
      !currentIncomingText;

    if (!canStart) {
      scheduleSignalGlitch(true);
      return;
    }

    if (Math.random() < SETTINGS.glitchChance) {
      triggerSignalGlitch();
      return;
    }

    scheduleSignalGlitch(true);
  }, delay);
}

function getGlitchRecoveryMessage(firstGlitch, level) {
  if (firstGlitch) {
    return randomItem(firstGlitchRecoveryMessages);
  }

  if (level >= 4) {
    return randomItem(highLevelGlitchMessages);
  }

  return randomItem(glitchRecoveryMessages);
}

async function triggerSignalGlitch() {
  if (isGlitchActive || !canRunGlitchToday()) {
    return;
  }

  const today = getLocalDateKey();
  const firstGlitch =
    safeGet(STORAGE_KEYS.glitchRewardClaimed, 'false') !== 'true';

  isGlitchActive = true;
  safeSet(STORAGE_KEYS.lastGlitchDate, today);

  document.body.classList.add('signal-disrupted');
  signalGlitch.classList.remove('hidden');
  signalGlitchText.textContent = 'SIGNAL UNSTABLE';

  connectionText.textContent = 'UNSTABLE';
  onlineIndicator.textContent = 'SIGNAL LOST';

  await wait(850);
  signalGlitchText.textContent = 'PACKET LOSS DETECTED';

  await wait(850);
  signalGlitchText.textContent = 'RECONNECTING...';

  await wait(1150);
  signalGlitchText.textContent = 'CONNECTION RESTORED';

  await wait(500);

  signalGlitch.classList.add('hidden');
  document.body.classList.remove('signal-disrupted');
  isGlitchActive = false;

  restoreConnectionDisplay();

  appendMessage('Communication line re-established.', {
    sender: 'SYSTEM',
    system: true,
    count: false
  });

  if (firstGlitch) {
    safeSet(STORAGE_KEYS.glitchRewardClaimed, 'true');
    addConnectionPoints(3, { announce: false });
  }

  const level = getConnectionLevelData().level;
  const recoveryMessage = getGlitchRecoveryMessage(firstGlitch, level);

  await receiveMessage(recoveryMessage, {
    delay: 1000,
    toast: true
  });

  announcePendingLevelUp();
}

function handleVisibilityChange() {
  if (document.hidden) {
    hiddenAt = Date.now();
    document.body.classList.add('connection-interrupted');
    return;
  }

  document.body.classList.remove('connection-interrupted');

  if (
    hiddenAt &&
    timerState.active &&
    !timerState.paused
  ) {
    const awayMs = Date.now() - hiddenAt;

    if (awayMs > 5000) {
      const remaining = Math.max(
        0,
        timerState.endAt - Date.now()
      );

      if (remaining > 0) {
        showToast(
          `Time remaining until the appointment: ${formatRemaining(remaining)}.`
        );
      }
    }
  }

  hiddenAt = null;
  updateTimerDisplay();
  restoreConnectionDisplay();
}

function bindEvents() {
  timeButtons.forEach(button => {
    button.addEventListener('click', () => {
      startTimer(Number(button.dataset.minutes));
    });
  });

  customStartButton.addEventListener('click', () => {
    startTimer(Number(customMinutes.value));
  });

  customMinutes.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      startTimer(Number(customMinutes.value));
    }
  });

  pauseTimerButton.addEventListener('click', pauseOrResumeTimer);
  cancelTimerButton.addEventListener('click', cancelTimer);
  openMessageButton.addEventListener('click', closeIncomingTransmission);

  document.addEventListener('visibilitychange', handleVisibilityChange);

  window.addEventListener('beforeunload', () => {
    saveTimerState();
  });
}

function initialize() {
  updateConnectionLevelUI();
  registerAccess();
  updateReceivedCount();
  restoreConnectionDisplay();
  startClock();
  bindEvents();
  runBootSequence();
}

initialize();
