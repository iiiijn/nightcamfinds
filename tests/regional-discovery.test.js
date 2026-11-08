"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {CHATURBATE_API_REGIONS,REGION_ORDER,normalizePartnerCountry,getDiscoveryRegion,buildRegionalRoomGroups}=require("../src/services/regional-discovery.cjs");
test("Chaturbate regional feed buckets cover the five public directory regions",()=>{
 assert.deepEqual(CHATURBATE_API_REGIONS,["asia","europe_russia","northamerica","southamerica","other"]);
});
test("country codes map to useful visitor-facing discovery regions",()=>{
 assert.equal(normalizePartnerCountry("United States"),"US");
 assert.equal(getDiscoveryRegion({country:"US"}),"North America");
 assert.equal(getDiscoveryRegion({country:"GB"}),"Western Europe");
 assert.equal(getDiscoveryRegion({country:"NO"}),"Northern Europe");
 assert.equal(getDiscoveryRegion({country:"DE"}),"Central & Eastern Europe");
 assert.equal(getDiscoveryRegion({country:"AU"}),"Asia-Pacific");
 assert.equal(getDiscoveryRegion({country:"KE"}),"Africa");
});
test("only recognized partner region labels are used when country is missing",()=>{
 assert.equal(getDiscoveryRegion({country:"",partnerRegion:"North America"}),"North America");
 assert.equal(getDiscoveryRegion({country:"",partnerRegion:"In your heart",apiRegion:"europe_russia"}),"Europe & Asia");
 assert.equal(getDiscoveryRegion({country:"",partnerRegion:"unknown place",apiRegion:"other"}),"Other");
});
test("regional top-room groups rank independently and cap each section",()=>{
 const rooms=[
  {id:"us1",country:"US",viewerCount:2},{id:"us2",country:"US",viewerCount:90},{id:"us3",country:"US",viewerCount:40},
  {id:"gb1",country:"GB",viewerCount:11},{id:"gb2",country:"GB",viewerCount:70},{id:"ke1",country:"KE",viewerCount:4}
 ];
 const groups=buildRegionalRoomGroups(rooms,"viewers",2);
 assert.deepEqual(Object.keys(groups),["North America","Western Europe","Africa"]);
 assert.deepEqual(groups["North America"].map(room=>room.id),["us2","us3"]);
 assert.deepEqual(groups["Western Europe"].map(room=>room.id),["gb2","gb1"]);
 assert.deepEqual(groups.Africa.map(room=>room.id),["ke1"]);
});
test("regional grouping supports already-filtered category result sets",()=>{
 const female=[{id:"f1",country:"US",gender:"female",viewerCount:5}];
 const male=[{id:"m1",country:"US",gender:"male",viewerCount:8}];
 assert.equal(buildRegionalRoomGroups(female)["North America"].length,1);
 assert.equal(buildRegionalRoomGroups(male)["North America"][0].gender,"male");
 assert.ok(REGION_ORDER.includes("North America"));
});
