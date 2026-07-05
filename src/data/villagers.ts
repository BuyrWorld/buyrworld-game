export interface Villager {
  id: string; n: string;
  hair: string; shirt: string; trouser: string;
  homeId: string; workId: string;
  quips: string[];
}

export const VILLAGERS: Villager[] = [
  { id:"agnes",  n:"Agnes",  hair:"#8a6a4a", shirt:"#c9a86a", trouser:"#6a5a4a", homeId:"home_01", workId:"hall",
    quips:["Morning, love! Tea's on if you want some.","My bunions are terrible today.","Have you seen Bertie? Always late, that one."] },
  { id:"bertie", n:"Bertie", hair:"#3a3a3a", shirt:"#8a6a4a", trouser:"#4a4a4a", homeId:"home_02", workId:"furnace",
    quips:["Lovely weather for it.","The furnace is running hot today.","Fancy a cuppa later?"] },
  { id:"clara",  n:"Clara",  hair:"#c9a24b", shirt:"#ffd666", trouser:"#3a5a3a", homeId:"home_03", workId:"stall_marge",
    quips:["Have you tried my shortbread? Melts in your mouth!","Fresh batch just in, love.","Marge makes the best pies in the village."] },
  { id:"derek",  n:"Derek",  hair:"#4a3a2a", shirt:"#4e7d5b", trouser:"#3a3a4a", homeId:"home_04", workId:"depot",
    quips:["Lorry's late again. What a surprise.","These manifests won't sort themselves.","Mind the forklift, it's got a dodgy steering."] },
  { id:"edna",   n:"Edna",   hair:"#8a7a6a", shirt:"#c9a8c8", trouser:"#5a4a5a", homeId:"home_05", workId:"trophy",
    quips:["Every trophy tells a story, dear.","I've been here since the beginning.","Did you know the old mayor won this one?"] },
  { id:"frank",  n:"Frank",  hair:"#6a4a2a", shirt:"#9a7050", trouser:"#4a5a3a", homeId:"home_06", workId:"sawmill",
    quips:["Good timber out east today.","Careful with the saw. It doesn't care who you are.","Pine smells better than oak. Fight me."] },
  { id:"gracie", n:"Gracie", hair:"#c9a24b", shirt:"#7cb46b", trouser:"#3a5a3a", homeId:"home_07", workId:"barn",
    quips:["The chickens are in a mood today.","Have you met Gerald? He's our oldest goat.","Fresh eggs if you need them!"] },
  { id:"hector", n:"Hector", hair:"#1a1a2a", shirt:"#4a6ea9", trouser:"#2a2a3a", homeId:"home_08", workId:"hall",
    quips:["The council minutes won't type themselves.","Policy is my passion. Budgets, less so.","Do you have an appointment?"] },
  { id:"ida",    n:"Ida",    hair:"#c08030", shirt:"#4a7a9a", trouser:"#3a3a5a", homeId:"home_09", workId:"pier",
    quips:["Up at five for the tide. Worth it every time.","The bass are running. Can feel it.","Marina and I go back years."] },
  { id:"jack",   n:"Jack",   hair:"#2a2a2a", shirt:"#b0574f", trouser:"#2a2a2a", homeId:"home_10", workId:"furnace",
    quips:["This heat's nothing. Try August at the foundry.","Bertie keeps nicking my gloves.","Coal, coke, charcoal — I can smell the difference."] },
  { id:"kitty",  n:"Kitty",  hair:"#8a4a4a", shirt:"#6a8aaa", trouser:"#3a3a4a", homeId:"home_11", workId:"workshop",
    quips:["If it's got a gear, I can fix it.","The lathe is acting up again.","You'd be surprised what duct tape won't fix."] },
  { id:"lenny",  n:"Lenny",  hair:"#5a4a3a", shirt:"#c9c9a0", trouser:"#4a4a3a", homeId:"home_12", workId:"depot",
    quips:["Reversing a lorry is an art form.","Derek lost the delivery notes. Again.","Third time round this roundabout today."] },
  { id:"mabel",  n:"Mabel",  hair:"#8a6a2a", shirt:"#e8c9d0", trouser:"#6a3a3a", homeId:"home_13", workId:"stall_bolt",
    quips:["Jam first, then cream. Non-negotiable.","The WI meet on Thursdays. You're welcome.","My Victoria sponge won the county fair, you know."] },
  { id:"ned",    n:"Ned",    hair:"#4a3a2a", shirt:"#5a7a4a", trouser:"#3a4a3a", homeId:"home_14", workId:"sawmill",
    quips:["Birds are early this morning.","The old oak in row four is massive.","Frank's loud, but he's good at his job."] },
  { id:"olive",  n:"Olive",  hair:"#c9a060", shirt:"#4da8cc", trouser:"#2a4a6a", homeId:"home_15", workId:"stall_marina",
    quips:["Freshest fish on the coast, guaranteed.","Marina taught me everything I know.","Tuna day! Best day of the week."] },
];
