import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Prowin CRM',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#c0392b',
    });
    await Notifications.setNotificationChannelAsync('clockin', {
      name: 'Clock-in Reminder',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#c0392b',
    });
  }

  return 'granted';
}

// ─── Daily 10:00 AM clock-in reminder ───────────────────────────────────────
export async function scheduleDailyClockIn() {
  await Notifications.cancelScheduledNotificationAsync('daily-clockin');
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '⏰ Prowin CRM — Clock In',
      body: "Good morning! It's 10:00 AM — tap to log your attendance.",
      data: { type: 'clockin' },
      sound: true,
    },
    trigger: {
      hour: 10,
      minute: 0,
      repeats: true,
    },
    identifier: 'daily-clockin',
  });
}

// ─── Cold-call follow-up reminder ───────────────────────────────────────────
export async function scheduleFollowUpReminder(
  contactId: string,
  contactName: string,
  phone: string | null,
  followUpAt: Date,
) {
  if (followUpAt <= new Date()) return;

  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('followups', {
      name: 'Follow-up Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#c0392b',
    });
  }

  const identifier = `followup-${contactId}`;
  await Notifications.cancelScheduledNotificationAsync(identifier);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '📞 Follow-up call due',
      body: `Call ${contactName}${phone ? ` · ${phone}` : ''}`,
      data: { type: 'followup', contactId },
      sound: true,
    },
    trigger: { date: followUpAt },
    identifier,
  });
}

export async function cancelFollowUpReminder(contactId: string) {
  await Notifications.cancelScheduledNotificationAsync(`followup-${contactId}`);
}

// ─── Task / meeting reminder ─────────────────────────────────────────────────
export async function scheduleTaskReminder(
  taskId: string,
  title: string,
  dueDate: Date,
  minutesBefore = 30
) {
  const triggerDate = new Date(dueDate.getTime() - minutesBefore * 60 * 1000);
  if (triggerDate <= new Date()) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `📋 Task reminder — ${minutesBefore} mins`,
      body: title,
      data: { type: 'task', taskId },
      sound: true,
    },
    trigger: { date: triggerDate },
    identifier: `task-${taskId}`,
  });
}

// ─── Cancel a task reminder ──────────────────────────────────────────────────
export async function cancelTaskReminder(taskId: string) {
  await Notifications.cancelScheduledNotificationAsync(`task-${taskId}`);
}

// ─── Voice note recording complete notification ──────────────────────────────
export async function notifyCallLogged(leadName: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '✅ Call logged',
      body: `AI summary saved for ${leadName}`,
      data: { type: 'call_logged' },
    },
    trigger: null,
  });
}
