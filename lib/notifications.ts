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

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Daily 10:00 AM clock-in reminder Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
export async function scheduleDailyClockIn() {
  await Notifications.cancelScheduledNotificationAsync('daily-clockin');
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Ã¢ÂÂ° Prowin CRM Ã¢â‚¬â€ Clock In',
      body: "Good morning! It's 10:00 AM Ã¢â‚¬â€ tap to log your attendance.",
      data: { type: 'clockin' },
      sound: true,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 10, minute: 0 },
    identifier: 'daily-clockin',
  });
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Cold-call follow-up reminder Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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
      title: 'Ã°Å¸â€œÅ¾ Follow-up call due',
      body: `Call ${contactName}${phone ? ` Ã‚Â· ${phone}` : ''}`,
      data: { type: 'followup', contactId },
      sound: true,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: followUpAt },
    identifier,
  });
}

export async function cancelFollowUpReminder(contactId: string) {
  await Notifications.cancelScheduledNotificationAsync(`followup-${contactId}`);
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Task / meeting reminder Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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
      title: `Ã°Å¸â€œâ€¹ Task reminder Ã¢â‚¬â€ ${minutesBefore} mins`,
      body: title,
      data: { type: 'task', taskId },
      sound: true,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
    identifier: `task-${taskId}`,
  });
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Cancel a task reminder Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
export async function cancelTaskReminder(taskId: string) {
  await Notifications.cancelScheduledNotificationAsync(`task-${taskId}`);
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Voice note recording complete notification Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
export async function notifyCallLogged(leadName: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Ã¢Å“â€¦ Call logged',
      body: `AI summary saved for ${leadName}`,
      data: { type: 'call_logged' },
    },
    trigger: null,
  });
}
