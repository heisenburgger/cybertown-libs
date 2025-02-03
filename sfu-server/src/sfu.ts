import os from "os";
import mediasoup from "mediasoup";
import { Worker, Router } from "mediasoup/node/lib/types.js";
import {
  ConnectTransportOptions,
  ConsumeOptions,
  InitOptions,
  ProduceTransportOptions,
  Room,
} from "./types.js";
import { Participant } from "./participant.js";

export class SFU {
  private workerIdx = 0;
  private workers: Worker[] = [];

  // maps worker pid to router
  private routers: Record<string, Router> = {};

  private rooms: Record<number, Room> = {};

  private options: InitOptions;

  constructor(options: InitOptions) {
    this.options = options;
  }

  async createWorkers() {
    const numOfCPUs = os.cpus().length;
    const workers: Worker[] = [];

    for (let i = 0; i < numOfCPUs; i++) {
      const worker = await mediasoup.createWorker(this.options.workerSettings);
      const router = await worker.createRouter(this.options.routerOptions);
      this.routers[worker.pid] = router;
      workers.push(worker);
    }

    this.workers = workers;
  }

  createRoom(roomID: number) {
    if (this.rooms[roomID]) {
      return;
    }

    const worker = this.workers[this.workerIdx];
    this.workerIdx = (this.workerIdx + 1) % this.workers.length;

    const router = this.routers[worker.pid];
    this.rooms[roomID] = {
      router,
      participants: {},
    };
  }

  async addParticipant(id: string, roomID: number) {
    const room = this.rooms[roomID];
    if (!room) {
      return;
    }

    const sendTransport = await this.createTransport(room);
    const recvTransport = await this.createTransport(room);

    const participant = new Participant(
      id,
      {
        recv: recvTransport,
        send: sendTransport,
      },
      room,
    );

    room.participants[id] = participant;

    return participant;
  }

  async removeParticipant(id: string, roomID: number) {
    const room = this.rooms[roomID];
    if (!room) {
      return;
    }

    const participant = room.participants[id];
    if (!participant) {
      return;
    }

    participant.close();

    delete room.participants[id];
  }

  async connectTransport(
    participantID: string,
    roomID: number,
    options: ConnectTransportOptions,
  ) {
    const room = this.rooms[roomID];
    if (!room) {
      return;
    }

    const participant = room.participants[participantID];
    if (!participant) {
      return;
    }

    participant.connectTransport(options.direction, options.dtlsParameters);
  }

  async produceTransport(
    participantID: string,
    roomID: number,
    options: ProduceTransportOptions,
  ) {
    const room = this.rooms[roomID];
    if (!room) {
      return;
    }
    const participant = room.participants[participantID];
    if (!participant) {
      return;
    }
    const producer = await participant.produce(
      options.source,
      options.rtpParameters,
    );
    return producer;
  }

  async consume(
    participantID: string,
    roomID: number,
    options: ConsumeOptions,
  ) {
    const room = this.rooms[roomID];
    if (!room) {
      return;
    }

    const participant = room.participants[participantID];
    if (!participant) {
      return;
    }

    const remoteParticipant = room.participants[options.remoteParticipantID];
    if (!remoteParticipant) {
      return;
    }

    const consumers = await participant.consume(
      options.sourceFilter,
      remoteParticipant,
    );
    return consumers;
  }

  async closeProducers(
    participantID: string,
    roomID: number,
    producerIDs: string[],
  ) {
    const room = this.rooms[roomID];
    if (!room) {
      return;
    }
    const participant = room.participants[participantID];
    if (!participant) {
      return;
    }
    participant.closeProducers(producerIDs);
  }

  async closeConsumers(
    participantID: string,
    roomID: number,
    consumerIDs: string[],
  ) {
    const room = this.rooms[roomID];
    if (!room) {
      return;
    }
    const participant = room.participants[participantID];
    if (!participant) {
      return;
    }
    participant.closeConsumers(consumerIDs);
  }

  async resumeConsumer(
    participantID: string,
    roomID: number,
    consumerID: string,
  ) {
    const room = this.rooms[roomID];
    if (!room) {
      return;
    }
    const participant = room.participants[participantID];
    if (!participant) {
      return;
    }
    participant.resumeConsumer(consumerID);
  }

  async deleteRooms(roomIDs: number[]) {
    for (const roomID of roomIDs) {
      const room = this.rooms[roomID];
      if (!room) {
        continue;
      }
      for (const participant of Object.values(room.participants)) {
        participant.close();
      }
      delete this.rooms[roomID];
    }
  }

  async getParticipant(participantID: string, roomID: number) {
    const room = this.rooms[roomID];
    if (!room) {
      return;
    }
    return room.participants[participantID];
  }

  async getRTPCapabilities(roomID: number) {
    const room = this.rooms[roomID];
    if (!room) {
      return;
    }
    return room.router.rtpCapabilities;
  }

  private async createTransport(room: Room) {
    return room.router.createWebRtcTransport(this.options.transportOptions);
  }
}
