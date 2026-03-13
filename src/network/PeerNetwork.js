// PeerJS-based networking for multiplayer
// Uses the global Peer class loaded from CDN

export class PeerNetwork {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.isHost = false;
    this.connected = false;

    // Callbacks
    this.onConnect = null;
    this.onDisconnect = null;
    this.onMessage = null;
    this.onError = null;
  }

  // Generate a short join code (6 chars)
  _generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  async host() {
    const code = this._generateCode();
    const peerId = `bugsiege-${code}`;

    return new Promise((resolve, reject) => {
      this.peer = new Peer(peerId);
      this.isHost = true;

      this.peer.on('open', () => {
        resolve(code);
      });

      this.peer.on('connection', (conn) => {
        this.conn = conn;
        this._setupConnection(conn);
      });

      this.peer.on('error', (err) => {
        if (this.onError) this.onError(err.type);
        reject(err);
      });
    });
  }

  async join(code) {
    const peerId = `bugsiege-${code.toUpperCase().replace(/[^A-Z0-9]/g, '')}`;

    return new Promise((resolve, reject) => {
      this.peer = new Peer();
      this.isHost = false;

      this.peer.on('open', () => {
        const conn = this.peer.connect(peerId, { reliable: true });
        this.conn = conn;

        conn.on('open', () => {
          this._setupConnection(conn);
          resolve();
        });

        conn.on('error', (err) => {
          if (this.onError) this.onError(err.type);
          reject(err);
        });
      });

      this.peer.on('error', (err) => {
        if (this.onError) this.onError(err.type);
        reject(err);
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!this.connected) {
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  _setupConnection(conn) {
    conn.on('open', () => {
      this.connected = true;
      if (this.onConnect) this.onConnect();
    });

    conn.on('data', (data) => {
      if (this.onMessage) this.onMessage(data);
    });

    conn.on('close', () => {
      this.connected = false;
      if (this.onDisconnect) this.onDisconnect();
    });

    conn.on('error', (err) => {
      if (this.onError) this.onError(err.type);
    });

    // If already open (host receives connection already open)
    if (conn.open) {
      this.connected = true;
      if (this.onConnect) this.onConnect();
    }
  }

  send(data) {
    if (this.conn && this.conn.open) {
      this.conn.send(data);
    }
  }

  disconnect() {
    this.connected = false;
    if (this.conn) {
      this.conn.close();
      this.conn = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }

  getJoinUrl(code) {
    const base = window.location.origin + window.location.pathname;
    return `${base}?join=${code}`;
  }
}
