"use strict";
const { isValidCountryRoom } = require("./country-directory.cjs");
function summarizeCountryRouteHealth({providerHealth={},rooms=[]}={}) {
 const states=["chaturbate","bongacams"].map(name=>providerHealth[name]||"unknown");
 const available=states.filter(state=>state==="available").length;
 const unavailable=states.filter(state=>state==="unavailable").length;
 const feedHealth=available===2||(available===1&&states.some(state=>state==="disabled"))?"healthy":available>0?"partial":unavailable>0?"unavailable":"unknown";
 const unique=new Map();
 for(const room of Array.isArray(rooms)?rooms:[])if(isValidCountryRoom(room))unique.set(room.id.trim(),room);
 const qualifyingRoomCount=unique.size;
 return {feedHealth,roomCount:Array.isArray(rooms)?rooms.length:0,qualifyingRoomCount,indexable:qualifyingRoomCount>=10};
}
module.exports={summarizeCountryRouteHealth};
