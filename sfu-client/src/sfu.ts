import type {
  Transport,
  RtpCapabilities,
  RtpParameters,
} from "mediasoup-client/lib/types";
import { Device } from "mediasoup-client";
import {
  Transports,
  ProduceTransport,
  ConnectTransport,
  ProduceEventCallback,
  TrackSource,
  TransportDirection,
  InitOptions,
  SFUProducer,
  SFUConsumer,
  ProducerAppData,
} from "./types";

export class SFU extends EventTarget {
  private device: Device | null = null;
  private transports: Transports = {};

  private producers: Record<string, SFUProducer> = {};
  private consumers: Record<string, SFUConsumer> = {};

  private produceEventCallbacks: Record<string, ProduceEventCallback> = {};

  public async init(options: InitOptions): Promise<RtpCapabilities> {
    this.device = new Device();
    await this.device.load({
      routerRtpCapabilities: options.routerRtpCapabilities,
    });

    if (options.sendTransportOptions) {
      this.transports.send = this.device.createSendTransport(
        options.sendTransportOptions,
      );
      this.onConnect("send", this.transports.send);
      this.onProduce(this.transports.send);
    }

    if (options.recvTransportOptions) {
      this.transports.recv = this.device.createSendTransport(
        options.recvTransportOptions,
      );
      this.onConnect("recv", this.transports.recv);
    }

    return this.device.rtpCapabilities;
  }

  public async produce(
    source: TrackSource,
    track: MediaStreamTrack,
  ): Promise<SFUProducer> {
    if (!this.transports?.send) {
      throw new Error("send transport must be setup to produce");
    }

    const producer = await this.transports.send.produce({
      track,
      appData: {
        source,
      },
    });
    this.producers[producer.id] = producer;

    return producer;
  }

  public async consume(
    source: TrackSource,
    userID: string,
    rtpParameters: RtpParameters,
  ): Promise<SFUConsumer> {
    if (!this.transports?.recv) {
      throw new Error("receive transport must be setup to consume");
    }

    const consumer = await this.transports.recv.consume({
      rtpParameters,
      appData: {
        source,
        userID,
      },
    });
    this.consumers[consumer.id] = consumer;

    return consumer;
  }

  public async close() {
    for (const consumer of Object.values(this.consumers)) {
      consumer.close();
    }

    for (const producer of Object.values(this.producers)) {
      producer.close();
    }

    if (this.transports.send) {
      this.transports.send.close();
    }

    if (this.transports.recv) {
      this.transports.recv.close();
    }

    this.device = null;
    this.produceEventCallbacks = {};
  }

  resolveProduceEvent(produceKey: string, producerID: string) {
    const produceEvent = this.produceEventCallbacks[produceKey];
    if (!produceEvent) {
      throw new Error(`no callback found for produce key '${produceKey}'`);
    }
    try {
      produceEvent.callback({ id: producerID });
      delete this.produceEventCallbacks[produceKey];
    } catch (err) {
      if (err instanceof Error) {
        produceEvent.errback(err);
      }
    }
  }

  closeProducers(callback: (producer: SFUProducer) => boolean): string[] {
    const producersToDelete = [];
    for (const producer of Object.values(this.producers)) {
      if (!callback(producer)) {
        continue;
      }
      producer.close();
      producersToDelete.push(producer.id);
    }
    for (const producerID of producersToDelete) {
      delete this.producers[producerID];
    }
    return producersToDelete;
  }

  closeConsumers(callback: (consumer: SFUConsumer) => boolean): string[] {
    const consumersToDelete = [];
    for (const consumer of Object.values(this.consumers)) {
      if (!callback(consumer)) {
        continue;
      }
      consumer.close();
      consumersToDelete.push(consumer.id);
    }
    for (const consumerID of consumersToDelete) {
      delete this.consumers[consumerID];
    }
    return consumersToDelete;
  }

  private onConnect(direction: TransportDirection, transport: Transport) {
    transport.on("connect", (data, callback, errback) => {
      const event = new CustomEvent<ConnectTransport>("connect", {
        detail: {
          dtlsParameters: data.dtlsParameters,
          direction,
        },
      });
      this.dispatchEvent(event);
      try {
        callback();
      } catch (err) {
        if (err instanceof Error) {
          errback(err);
        }
      }
    });
  }

  private onProduce(transport: Transport) {
    transport.on("produce", (data, callback, errback) => {
      const producerKey = crypto.randomUUID();

      this.produceEventCallbacks[producerKey] = {
        callback,
        errback,
      };

      const event = new CustomEvent<ProduceTransport>("produce", {
        detail: {
          rtpParameters: data.rtpParameters,
          producerKey,
          source: (data.appData as ProducerAppData).source,
        },
      });
      this.dispatchEvent(event);
    });
  }
}
