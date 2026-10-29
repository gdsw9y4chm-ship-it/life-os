export interface User {
  id: string;
  name: string;
  avatar: string | null;
  theme: string;
  timezone: string;
  week_start: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  locale: string;
  created_at: string;
  updated_at: string;
}

export interface UserRepository {
  getCurrent(): User | null;
  seedInitial(): User;
}
