import { Snaptrade } from "snaptrade-typescript-sdk";

// SDK option is named `consumerKey`; our env var is `SNAPTRADE_CONSUMER_SECRET`
// to match SnapTrade's dashboard nomenclature. They're the same value.
export const snaptrade = new Snaptrade({
  clientId: process.env.SNAPTRADE_CLIENT_ID!,
  consumerKey: process.env.SNAPTRADE_CONSUMER_SECRET!,
});
