import { RtpCapabilities, RtpParameters } from "mediasoup/node/lib/types.js";
import {
  DtlsParameters,
  WebRtcTransport,
} from "mediasoup/node/lib/WebRtcTransportTypes.js";
import {
  Room,
  SFUConsumer,
  SFUProducer,
  TrackSource,
  TransportDirection,
  Transports,
} from "./types.js";

export class Participant {
  private id: string;

  private transports: {
    send: WebRtcTransport;
    recv: WebRtcTransport;
  };

  private room: Room;

  private consumers: Record<string, SFUConsumer> = {};
  private producers: Record<string, SFUProducer> = {};

  private rtpCapabilities: RtpCapabilities | null = null;

  constructor(id: string, transports: Transports, room: Room) {
    this.id = id;
    this.transports = transports;
    this.room = room;
  }

  connectTransport(
    direction: TransportDirection,
    dtlsParameters: DtlsParameters,
  ) {
    const transport = this.transports[direction];
    transport.connect({ dtlsParameters });
  }

  setRTPCapabilities(rtpCapabilities: RtpCapabilities) {
    this.rtpCapabilities = rtpCapabilities;
  }

  async produce(source: TrackSource, rtpParameters: RtpParameters) {
    const transport = this.transports.send;
    const producer = await transport.produce({
      rtpParameters,
      appData: {
        source,
      },
      kind:
        source === "microphone" || source === "screenshare-audio"
          ? "audio"
          : "video",
    });
    this.producers[producer.id] = producer;
    return producer;
  }

  async consume(sourceFilter: string, participant: Participant) {
    const transport = this.transports.recv;

    const producers = Object.values(participant.producers).filter((producer) =>
      producer.appData.source.includes(sourceFilter),
    );

    const consumers: SFUConsumer[] = [];

    for (const producer of producers) {
      const canConsume = this.room.router.canConsume({
        producerId: producer.id,
        rtpCapabilities: participant.rtpCapabilities!,
      });
      if (!canConsume) {
        console.log(
          `sfu: producer ${producer.id} cannot be consumed by participant ${participant.id}`,
        );
        continue;
      }

      const consumer = await transport.consume({
        producerId: producer.id,
        rtpCapabilities: participant.rtpCapabilities!,
        appData: {
          source: producer.appData.source,
          participantID: participant.id,
        },
      });
      this.consumers[consumer.id] = consumer;
      consumers.push(consumer);
    }

    return consumers;
  }

  resumeConsumer(consumerID: string) {
    const consumer = this.consumers[consumerID];
    if (!consumer) {
      return;
    }
    consumer.resume();
  }

  closeProducers(producerIDs: string[]): string[] {
    const closedProducers: string[] = [];
    for (const producerID of producerIDs) {
      const producer = this.producers[producerID];
      if (!producer) {
        continue;
      }
      this.closeProducer(producer);
      closedProducers.push(producerID);
    }
    for (const producerID of closedProducers) {
      delete this.producers[producerID];
    }
    return closedProducers;
  }

  closeConsumers(consumerIDs: string[]): string[] {
    const closedConsumers: string[] = [];
    for (const consumerID of consumerIDs) {
      const consumer = this.consumers[consumerID];
      if (!consumer) {
        continue;
      }
      consumer.close();
      closedConsumers.push(consumerID);
    }
    for (const consumerID of closedConsumers) {
      delete this.consumers[consumerID];
    }
    return closedConsumers;
  }

  close() {
    for (const producer of Object.values(this.producers)) {
      this.closeProducer(producer);
    }

    for (const consumer of Object.values(this.consumers)) {
      consumer.close();
    }

    for (const transport of Object.values(this.transports)) {
      transport.close();
    }
  }

  private closeProducer(producer: SFUProducer) {
    producer.close();

    for (const participant of Object.values(this.room.participants)) {
      const closedConsumers: string[] = [];
      for (const consumer of Object.values(participant.consumers)) {
        if (producer.id !== consumer.producerId) {
          continue;
        }
        consumer.close();
        closedConsumers.push(consumer.id);
      }
      for (const consumerID of closedConsumers) {
        delete participant.consumers[consumerID];
      }
    }
  }
}
