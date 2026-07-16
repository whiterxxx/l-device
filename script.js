'use strict';

const STORAGE_KEYS = {
  accessCount: 'lDeviceAccessCount',
  completedCount: 'lDeviceCompletedCount',
  streak: 'lDeviceStreak',
  lastAccessDate: 'lDeviceLastAccessDate',
  timerState: 'lDeviceTimerState'
};

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

const sessionStartedAt = Date.now();

let sessionReceived = 0;
let clockIntervalId = null;
let timerIntervalId = null;
let idleTimeoutId = null;
let toastTimeoutId = null;
let currentIncomingText = '';
let hiddenAt = null;
let audioContext = null;

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
    '接続を確認しました。朝ですね。今日の予定を順番に片付けていきましょう。',
    'おはようございます。端末は正常です。今日も一日頑張りましょう。',
    '朝の通信を開始します。次に会う時刻を決めましょう。'
  ],

  daytime: [
    '接続を確認しました。作業を始めましょう。',
    '通信状態は安定しています。次の区切りを決めましょうか。',
    '戻りましたね。端末の接続状況は正常です。'
  ],

  evening: [
    '接続を確認しました。今日の残り時間は、こちらで管理しています。',
    '夜の通信を開始します。短時間でも、集中することが重要です。',
    'おかえりなさい。次に会う時刻を決めてください。'
  ],

  lateNight: [
    'こんな時刻まで起きているんですね。長時間の作業は勧めません。',
    '接続を確認しました。眠る前に終える時刻を決めてください。',
    'まだ眠っていないとは。短時間で区切りましょうか。'
  ]
};

const idleMessages = [
  '通信は維持されています。',
  'こちらにいます。時刻を設定してください。',
  '画面を開いたままにしていることは確認しています。',
  '静かですね。作業は進んでいますか？',
  '記録は正常に保存されています。',
  '次の通信まで、待っています。'
];

const appointmentStartMessages = [
  minutes =>
    `${minutes}分後に通信します。それまで、目の前のことに集中してください。`,

  minutes =>
    `通信予約を受け付けました。${minutes}分後に会いましょう。`,

  minutes =>
    `${minutes}分だけ離れます。約束の時刻に戻ってきてください。`,

  minutes =>
    `次の接続は${minutes}分後です。こちらから接続します。`
];

const completionMessages = [
  '約束の時間です。戻ってきましたね。',
  '通信を再開します。予定時刻どおりです。',
  '時間になりました。よく集中していましたね。',
  '接続時刻です。こちらへ戻ってきてください。',
  '予定していた時間が終了しました。少し休んでください。'
];

const cancelMessages = [
  '通信予約を取り消しました。必要なら設定し直してください。',
  '予定を解除しました。記録には完了とは残しません。',
  '中止を確認しました。次の約束は、続けられる時間で決めましょう。'
];

const pauseMessages = [
  '時間計測を一時停止しました。',
  '通信予定を保留しました。',
  '停止を確認しました。再開するまで時刻は進みません。'
];

const resumeMessages = [
  '計測を再開します。',
  '通信予定を再設定しました。',
  '再開を確認しました。計測を続けます。'
];

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
    // 保存できない環境でも端末は動作します。
  }
}

function safeRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    // 何もしません。
  }
}

function randomItem(items) {
  return items[
    Math.floor(Math.random() * items.length)
  ];
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
  const seconds = Math.max(
    0,
    Math.floor(totalSeconds)
  );

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(
    (seconds % 3600) / 60
  );
  const restSeconds = seconds % 60;

  return [
    pad(hours),
    pad(minutes),
    pad(restSeconds)
  ].join(':');
}

function formatRemaining(milliseconds) {
  const totalSeconds = Math.max(
    0,
    Math.ceil(milliseconds / 1000)
  );

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

  clockIntervalId = window.setInterval(
    updateClock,
    1000
  );
}

function registerAccess() {
  const today = getLocalDateKey();

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const yesterdayKey = getLocalDateKey(yesterday);

  const previousAccessCount =
    Number(
      safeGet(
        STORAGE_KEYS.accessCount,
        '0'
      )
    ) || 0;

  const previousCompletedCount =
    Number(
      safeGet(
        STORAGE_KEYS.completedCount,
        '0'
      )
    ) || 0;

  const previousStreak =
    Number(
      safeGet(
        STORAGE_KEYS.streak,
        '0'
      )
    ) || 0;

  const lastDate = safeGet(
    STORAGE_KEYS.lastAccessDate,
    ''
  );

  const nextAccessCount =
    previousAccessCount + 1;

  let nextStreak = previousStreak;

  if (lastDate !== today) {
    nextStreak =
      lastDate === yesterdayKey
        ? Math.max(1, previousStreak + 1)
        : 1;

    safeSet(
      STORAGE_KEYS.lastAccessDate,
      today
    );

    safeSet(
      STORAGE_KEYS.streak,
      String(nextStreak)
    );
  }

  safeSet(
    STORAGE_KEYS.accessCount,
    String(nextAccessCount)
  );

  accessCount.textContent =
    String(nextAccessCount);

  completedCount.textContent =
    String(previousCompletedCount);

  streakCount.textContent =
    `${nextStreak} ${
      nextStreak === 1
        ? 'DAY'
        : 'DAYS'
    }`;
}

function incrementCompletedCount() {
  const current =
    Number(
      safeGet(
        STORAGE_KEYS.completedCount,
        '0'
      )
    ) || 0;

  const next = current + 1;

  safeSet(
    STORAGE_KEYS.completedCount,
    String(next)
  );

  completedCount.textContent =
    String(next);
}

function updateReceivedCount() {
  receivedCount.textContent =
    String(sessionReceived);
}

function setConnectionLamp(timerActive) {
  connectionLamp.classList.toggle(
    'timer-active',
    timerActive
  );

  document.body.classList.toggle(
    'timer-running',
    timerActive
  );
}

function createMessageElement(
  text,
  sender = 'L',
  isSystem = false
) {
  const article =
    document.createElement('article');

  article.className =
    isSystem
      ? 'message system-message'
      : 'message l-message';

  const header =
    document.createElement('div');

  header.className =
    'message-header';

  const time =
    document.createElement('time');

  time.className =
    'message-time';

  time.textContent =
    formatClock();

  const source =
    document.createElement('span');

  source.className =
    'message-sender';

  source.textContent =
    sender;

  const paragraph =
    document.createElement('p');

  paragraph.className =
    'message-text';

  paragraph.textContent =
    text;

  header.append(
    time,
    source
  );

  article.append(
    header,
    paragraph
  );

  return article;
}

function appendMessage(
  text,
  options = {}
) {
  const {
    sender = 'L',
    system = false,
    count = !system
  } = options;

  const message =
    createMessageElement(
      text,
      sender,
      system
    );

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
  typingIndicator.classList.remove(
    'hidden'
  );

  return new Promise(resolve => {
    window.setTimeout(() => {
      typingIndicator.classList.add(
        'hidden'
      );

      resolve();
    }, duration);
  });
}

async function receiveMessage(
  text,
  options = {}
) {
  const {
    delay = 700,
    toast = false,
    sender = 'L'
  } = options;

  await showTyping(delay);

  appendMessage(
    text,
    { sender }
  );

  if (toast) {
    showToast(
      '新しい通信を受信しました。'
    );
  }
}

function showToast(
  text,
  duration = 3200
) {
  window.clearTimeout(
    toastTimeoutId
  );

  notificationText.textContent =
    text;

  notificationToast.classList.remove(
    'hidden'
  );

  toastTimeoutId =
    window.setTimeout(() => {
      notificationToast.classList.add(
        'hidden'
      );
    }, duration);
}

function getOpeningMessage() {
  const hour =
    new Date().getHours();

  if (hour >= 5 && hour < 11) {
    return randomItem(
      openingMessages.morning
    );
  }

  if (hour >= 11 && hour < 18) {
    return randomItem(
      openingMessages.daytime
    );
  }

  if (hour >= 18 && hour < 24) {
    return randomItem(
      openingMessages.evening
    );
  }

  return randomItem(
    openingMessages.lateNight
  );
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
      bootProgressBar.style.width =
        `${step.progress}%`;

      bootMessage.textContent =
        step.text;

      if (
        index ===
        steps.length - 1
      ) {
        window.setTimeout(
          async () => {
            terminal.classList.remove(
              'terminal-hidden'
            );

            bootScreen.classList.add(
              'boot-hidden'
            );

            await receiveMessage(
              getOpeningMessage(),
              { delay: 850 }
            );

            restoreTimerState();
            scheduleIdleMessage();
          },
          450
        );
      }
    }, elapsed);
  });
}

function scheduleIdleMessage() {
  window.clearTimeout(
    idleTimeoutId
  );

  const delay =
    150000 +
    Math.floor(
      Math.random() * 150000
    );

  idleTimeoutId =
    window.setTimeout(async () => {
      if (
        !timerState.active &&
        !document.hidden
      ) {
        await receiveMessage(
          randomItem(idleMessages),
          { delay: 750 }
        );
      }

      scheduleIdleMessage();
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
      audioContext =
        new AudioContextClass();
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

    if (
      audioContext.state ===
      'suspended'
    ) {
      audioContext
        .resume()
        .catch(() => {});
    }

    const now =
      audioContext.currentTime;

    const oscillator =
      audioContext.createOscillator();

    const gain =
      audioContext.createGain();

    oscillator.type = 'sine';

    oscillator.frequency.setValueAtTime(
      740,
      now
    );

    oscillator.frequency.setValueAtTime(
      920,
      now + 0.12
    );

    gain.gain.setValueAtTime(
      0.0001,
      now
    );

    gain.gain.exponentialRampToValueAtTime(
      0.11,
      now + 0.02
    );

    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      now + 0.34
    );

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.35);
  } catch (error) {
    // 音を再生できない場合は画面内通知を使います。
  }
}

function saveTimerState() {
  if (!timerState.active) {
    safeRemove(
      STORAGE_KEYS.timerState
    );

    return;
  }

  safeSet(
    STORAGE_KEYS.timerState,
    JSON.stringify(timerState)
  );
}

function loadTimerState() {
  const raw =
    safeGet(
      STORAGE_KEYS.timerState,
      ''
    );

  if (!raw) {
    return null;
  }

  try {
    const parsed =
      JSON.parse(raw);

    if (
      !parsed ||
      typeof parsed !== 'object'
    ) {
      return null;
    }

    return {
      active: Boolean(parsed.active),
      paused: Boolean(parsed.paused),
      durationMs:
        Number(parsed.durationMs) || 0,
      endAt:
        Number(parsed.endAt) || 0,
      remainingMs:
        Number(parsed.remainingMs) || 0,
      startedAt:
        Number(parsed.startedAt) || 0
    };
  } catch (error) {
    return null;
  }
}

function setTimerButtonsDisabled(
  disabled
) {
  timeButtons.forEach(button => {
    button.disabled = disabled;
  });

  customMinutes.disabled =
    disabled;

  customStartButton.disabled =
    disabled;
}

function updateTimerDisplay() {
  if (!timerState.active) {
    return;
  }

  const now = Date.now();

  const remaining =
    timerState.paused
      ? timerState.remainingMs
      : Math.max(
          0,
          timerState.endAt - now
        );

  remainingTime.textContent =
    formatRemaining(remaining);

  const endDate =
    timerState.paused
      ? new Date(now + remaining)
      : new Date(timerState.endAt);

  timerEndTime.textContent =
    timerState.paused
      ? `一時停止中 / 再開後 ${
          formatClock(endDate).slice(
            0,
            5
          )
        }`
      : `接続予定時刻 ${
          formatClock(endDate).slice(
            0,
            5
          )
        }`;

  const elapsed =
    Math.max(
      0,
      timerState.durationMs -
        remaining
    );

  const progress =
    timerState.durationMs > 0
      ? Math.min(
          100,
          Math.max(
            0,
            (
              elapsed /
              timerState.durationMs
            ) * 100
          )
        )
      : 0;

  timerProgressBar.style.width =
    `${progress}%`;

  if (
    !timerState.paused &&
    remaining <= 0
  ) {
    completeTimer();
  }
}

function startTimerInterval() {
  window.clearInterval(
    timerIntervalId
  );

  updateTimerDisplay();

  timerIntervalId =
    window.setInterval(
      updateTimerDisplay,
      250
    );
}

function startTimer(minutes) {
  const numericMinutes =
    Number(minutes);

  if (
    !Number.isFinite(
      numericMinutes
    ) ||
    numericMinutes < 1 ||
    numericMinutes > 180
  ) {
    showToast(
      '1分から180分の範囲で設定してください。'
    );

    customMinutes.focus();
    return;
  }

  initializeAudio();

  window.clearInterval(
    timerIntervalId
  );

  const durationMs =
    Math.round(
      numericMinutes *
      60 *
      1000
    );

  timerState = {
    active: true,
    paused: false,
    durationMs,
    endAt:
      Date.now() + durationMs,
    remainingMs: durationMs,
    startedAt: Date.now()
  };

  saveTimerState();
  setTimerButtonsDisabled(true);
  setConnectionLamp(true);

  activeTimerPanel.classList.remove(
    'hidden'
  );

  pauseTimerButton.textContent =
    'PAUSE';

  connectionText.textContent =
    'SCHEDULED';

  onlineIndicator.textContent =
    'WAITING';

  startTimerInterval();

  receiveMessage(
    randomItem(
      appointmentStartMessages
    )(numericMinutes),
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
    timerState.remainingMs =
      Math.max(
        0,
        timerState.endAt -
          Date.now()
      );

    timerState.paused = true;

    pauseTimerButton.textContent =
      'RESUME';

    connectionText.textContent =
      'ON HOLD';

    onlineIndicator.textContent =
      'PAUSED';

    receiveMessage(
      randomItem(pauseMessages),
      { delay: 450 }
    );
  } else {
    timerState.paused = false;

    timerState.endAt =
      Date.now() +
      timerState.remainingMs;

    pauseTimerButton.textContent =
      'PAUSE';

    connectionText.textContent =
      'SCHEDULED';

    onlineIndicator.textContent =
      'WAITING';

    receiveMessage(
      randomItem(resumeMessages),
      { delay: 450 }
    );
  }

  setConnectionLamp(true);
  saveTimerState();
  updateTimerDisplay();
}

function cancelTimer() {
  if (!timerState.active) {
    return;
  }

  window.clearInterval(
    timerIntervalId
  );

  timerState = {
    active: false,
    paused: false,
    durationMs: 0,
    endAt: 0,
    remainingMs: 0,
    startedAt: 0
  };

  saveTimerState();
  setConnectionLamp(false);

  activeTimerPanel.classList.add(
    'hidden'
  );

  setTimerButtonsDisabled(false);

  connectionText.textContent =
    'SECURE';

  onlineIndicator.textContent =
    'ONLINE';

  timerProgressBar.style.width =
    '0%';

  receiveMessage(
    randomItem(cancelMessages),
    { delay: 500 }
  );
}

function completeTimer() {
  if (!timerState.active) {
    return;
  }

  window.clearInterval(
    timerIntervalId
  );

  const message =
    randomItem(
      completionMessages
    );

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
  setTimerButtonsDisabled(false);
  setConnectionLamp(true);

  activeTimerPanel.classList.add(
    'hidden'
  );

  connectionText.textContent =
    'INCOMING';

  onlineIndicator.textContent =
    'RECEIVING';

  timerProgressBar.style.width =
    '100%';

  currentIncomingText = message;

  incomingMessage.textContent =
    message;

  incomingOverlay.classList.remove(
    'hidden'
  );

  document.title =
    '通信を受信しました / L DEVICE';

  playSignal();

  showToast(
    '約束の時刻になりました。',
    5000
  );

  if (
    document.hidden &&
    'Notification' in window &&
    Notification.permission ===
      'granted'
  ) {
    try {
      new Notification(
        'L DEVICE',
        {
          body: message
        }
      );
    } catch (error) {
      // 通知が使えない場合は画面内通知を使います。
    }
  }
}

function restoreTimerState() {
  const stored =
    loadTimerState();

  if (
    !stored ||
    !stored.active
  ) {
    setConnectionLamp(false);
    return;
  }

  timerState = stored;

  if (
    !timerState.paused &&
    timerState.endAt <= Date.now()
  ) {
    timerState.active = true;
    completeTimer();
    return;
  }

  setTimerButtonsDisabled(true);
  setConnectionLamp(true);

  activeTimerPanel.classList.remove(
    'hidden'
  );

  pauseTimerButton.textContent =
    timerState.paused
      ? 'RESUME'
      : 'PAUSE';

  connectionText.textContent =
    timerState.paused
      ? 'ON HOLD'
      : 'SCHEDULED';

  onlineIndicator.textContent =
    timerState.paused
      ? 'PAUSED'
      : 'WAITING';

  startTimerInterval();
}

function closeIncomingTransmission() {
  incomingOverlay.classList.add(
    'hidden'
  );

  document.title =
    'L DEVICE';

  connectionText.textContent =
    'SECURE';

  onlineIndicator.textContent =
    'ONLINE';

  setConnectionLamp(false);

  if (currentIncomingText) {
    appendMessage(
      currentIncomingText,
      { sender: 'L' }
    );

    currentIncomingText = '';
  }
}

function handleVisibilityChange() {
  if (document.hidden) {
    hiddenAt = Date.now();

    document.body.classList.add(
      'connection-interrupted'
    );

    return;
  }

  document.body.classList.remove(
    'connection-interrupted'
  );

  if (
    hiddenAt &&
    timerState.active &&
    !timerState.paused
  ) {
    const awayMs =
      Date.now() - hiddenAt;

    if (awayMs > 5000) {
      const remaining =
        Math.max(
          0,
          timerState.endAt -
            Date.now()
        );

      if (remaining > 0) {
        showToast(
          `予定時刻まで残り ${
            formatRemaining(
              remaining
            )
          } です。`
        );
      }
    }
  }

  hiddenAt = null;
  updateTimerDisplay();
}

function bindEvents() {
  timeButtons.forEach(button => {
    button.addEventListener(
      'click',
      () => {
        startTimer(
          Number(
            button.dataset.minutes
          )
        );
      }
    );
  });

  customStartButton.addEventListener(
    'click',
    () => {
      startTimer(
        Number(
          customMinutes.value
        )
      );
    }
  );

  customMinutes.addEventListener(
    'keydown',
    event => {
      if (event.key === 'Enter') {
        startTimer(
          Number(
            customMinutes.value
          )
        );
      }
    }
  );

  pauseTimerButton.addEventListener(
    'click',
    pauseOrResumeTimer
  );

  cancelTimerButton.addEventListener(
    'click',
    cancelTimer
  );

  openMessageButton.addEventListener(
    'click',
    closeIncomingTransmission
  );

  document.addEventListener(
    'visibilitychange',
    handleVisibilityChange
  );

  window.addEventListener(
    'beforeunload',
    () => {
      saveTimerState();
    }
  );
}

function initialize() {
  registerAccess();
  updateReceivedCount();
  setConnectionLamp(false);
  startClock();
  bindEvents();
  runBootSequence();
}

initialize();
