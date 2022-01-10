import { BigInt, ethereum } from "@graphprotocol/graph-ts/index";
import {
  BadgeAward,
  BadgeAwardMetadata,
  BadgeDefinition,
  BadgeTrack,
  EntityStats,
  GraphAccount,
  Protocol,
  Winner,
} from "../../generated/schema";
import { PROTOCOL_NAME_THE_GRAPH, zeroBI } from "./constants";

export function createOrLoadEntityStats(): EntityStats {
  let entityStats = EntityStats.load("1");

  if (entityStats == null) {
    entityStats = new EntityStats("1");
    entityStats.voterCount = 0;
    entityStats.indexerCount = 0;
    entityStats.delegatorCount = 0;
    entityStats.curatorCount = 0;
    entityStats.publisherCount = 0;
    entityStats.awardCount = 0;
    entityStats.save();

    // _createTestBadgeAwards();     // awards badges to DAO and dev addresses
  }

  return entityStats as EntityStats;
}

export class BadgeAwardEventMetadata {
  readonly name: string;
  readonly value: string;

  constructor(name: string, value: string) {
    this.name = name;
    this.value = value;
  }
}

export class BadgeAwardEventData {
  readonly blockNumber: BigInt;
  readonly transactionHash: string;
  readonly timestamp: BigInt;
  readonly metadata: Array<BadgeAwardEventMetadata>;
  constructor(event: ethereum.Event, metadata: Array<BadgeAwardEventMetadata>) {
    this.blockNumber = event.block.number;
    this.transactionHash = event.transaction.hash.toHexString();
    this.timestamp = event.block.timestamp;
    this.metadata = metadata;
  }
}

////////////////      Winner

export function createOrLoadWinner(address: string): Winner {
  let winner = Winner.load(address);

  if (winner == null) {
    winner = new Winner(address);
    winner.awardCount = 0;
    winner.mintedAwardCount = 0;
    winner.votingPower = zeroBI();

    winner.save();
  }

  return winner as Winner;
}

////////////////      GraphAccount

export function createOrLoadGraphAccount(address: string): GraphAccount {
  let graphAccount = GraphAccount.load(address);

  if (graphAccount == null) {
    createOrLoadWinner(address);
    graphAccount = new GraphAccount(address);
    graphAccount.winner = address;
    graphAccount.awardCount = 0;
    graphAccount.votingPower = zeroBI();

    graphAccount.save();
  }

  return graphAccount as GraphAccount;
}

export function createBadgeAward(
  badgeDefinition: BadgeDefinition,
  winnerId: string,
  eventData: BadgeAwardEventData
): void {
  // award badge
  let badgeId = badgeDefinition.id.concat("-").concat(winnerId);
  let badgeAward = BadgeAward.load(badgeId);

  if (badgeAward == null) {
    // increment global awardCount
    let entityStats = createOrLoadEntityStats();
    entityStats.awardCount = entityStats.awardCount + 1;
    entityStats.save();

    // increment badgeDefinition awardCount
    badgeDefinition.awardCount = badgeDefinition.awardCount + 1;
    badgeDefinition.save();

    badgeAward = new BadgeAward(badgeId);
    badgeAward.winner = winnerId;
    badgeAward.definition = badgeDefinition.id;
    badgeAward.blockAwarded = eventData.blockNumber;
    badgeAward.transactionHash = eventData.transactionHash;
    badgeAward.timestampAwarded = eventData.timestamp;
    badgeAward.globalAwardNumber = entityStats.awardCount;
    badgeAward.awardNumber = badgeDefinition.awardCount;
    badgeAward.save();

    for (let i = 0; i < eventData.metadata.length; i++) {
      let metadata = eventData.metadata[i] as BadgeAwardEventMetadata;
      _createOrLoadBadgeAwardMetaData(badgeId, metadata.name, metadata.value);
    }
  }

  _updateAccountWithBadgeAward(badgeAward as BadgeAward);
}

function _createOrLoadBadgeAwardMetaData(
  badgeAwardId: string,
  name: string,
  value: string
): void {
  let metadataId = badgeAwardId.concat("-").concat(name);
  let metadata = BadgeAwardMetadata.load(metadataId);
  if (metadata == null) {
    metadata = new BadgeAwardMetadata(metadataId);
    metadata.badgeAward = badgeAwardId;
    metadata.name = name;
    metadata.value = value;
    metadata.save();
  }
}

function _updateAccountWithBadgeAward(badgeAward: BadgeAward): void {
  let winner = createOrLoadWinner(badgeAward.winner);
  let graphAccount = createOrLoadGraphAccount(badgeAward.winner);
  winner.awardCount = winner.awardCount + 1;
  graphAccount.awardCount = graphAccount.awardCount + 1;
  let badgeDefinition = BadgeDefinition.load(badgeAward.definition);
  let badgeVotingPower = badgeDefinition.votingPower;
  if (badgeVotingPower.gt(zeroBI())) {
    // winner just earned their first voting power
    if (winner.votingPower.equals(zeroBI())) {
      let entityStats = createOrLoadEntityStats();
      entityStats.voterCount = entityStats.voterCount + 1;
      entityStats.save();
    }
    winner.votingPower = badgeDefinition.votingPower.plus(winner.votingPower);
    graphAccount.votingPower = badgeDefinition.votingPower.plus(
      graphAccount.votingPower
    );
  }

  winner.save();
  graphAccount.save();
}

export function createOrLoadBadgeDefinition(
  name: string,
  description: string,
  badgeTrack: string,
  voteWeight: BigInt,
  image: string
): BadgeDefinition {
  let badgeDefinition = BadgeDefinition.load(name);

  if (badgeDefinition == null) {
    badgeDefinition = new BadgeDefinition(name);
    badgeDefinition.description = description;
    badgeDefinition.badgeTrack = badgeTrack;
    badgeDefinition.image = image;
    badgeDefinition.votingPower = voteWeight;
    badgeDefinition.awardCount = 0;

    badgeDefinition.save();
  }

  return badgeDefinition as BadgeDefinition;
}

export function createOrLoadTheGraphProtocol(): Protocol {
  let protocol = Protocol.load(PROTOCOL_NAME_THE_GRAPH);

  if (protocol == null) {
    protocol = new Protocol(PROTOCOL_NAME_THE_GRAPH);
    protocol.save();
  }

  return protocol as Protocol;
}

export function createOrLoadBadgeTrack(
  trackName: string,
  protocolRole: string,
  protocol: string
): BadgeTrack {
  let badgeTrack = BadgeTrack.load(trackName);

  if (badgeTrack == null) {
    badgeTrack = new BadgeTrack(trackName);
    badgeTrack.protocolRole = protocolRole;
    badgeTrack.protocol = protocol;

    if (protocol == PROTOCOL_NAME_THE_GRAPH) {
      createOrLoadTheGraphProtocol();
    }

    badgeTrack.save();
  }
  return badgeTrack as BadgeTrack;
}
