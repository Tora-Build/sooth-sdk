import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import { MarketCreated } from "../types/SoothMarketFactory/SoothMarketFactory";
import { Resolved } from "../types/SoothMarket/SoothMarket";
import { Market } from "../types/schema";

export function handleMarketCreated(event: MarketCreated): void {
  let id = event.params.market.toHexString();
  let market = new Market(id);
  market.adjudicatorId = event.params.adjudicatorId;
  market.eventId = event.params.eventId;
  market.isResolved = false;
  market.save();
}

export function handleResolved(event: Resolved): void {
  let id = event.address.toHexString();
  let market = Market.load(id);
  if (market == null) {
    market = new Market(id);
    market.adjudicatorId = Bytes.empty();
    market.eventId = Bytes.empty();
  }
  market.isResolved = true;
  market.winningOutcome = event.params.outcomeIndex;
  market.resolutionTime = BigInt.fromI32(event.params.eventTimestamp as i32);
  market.save();
}
