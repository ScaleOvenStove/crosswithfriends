import User from './user';

export default class DemoUser extends User {
  constructor(fb?: any) {
    super();
    this.fb = fb || null;
    this.attached = false;
  }

  attach(): void {
    setTimeout(() => {
      this.attached = true;
      this.emit('auth');
    }, 0);
  }

  detach(): void {}

  logIn(): void {
    this.fb = {
      id: 'demo-fb-id',
    };
    this.emit('auth');
  }
}

let globalUser: DemoUser | null = null;
export const getUser = (): DemoUser => {
  if (!globalUser) {
    globalUser = new DemoUser();
    globalUser.attach();
  }
  return globalUser;
};
