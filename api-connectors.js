export const API_CATALOG = {
  weather: {
    id:'weather',
    name:'Live Weather',
    emoji:'🌦️',
    provider:'Open-Meteo',
    queryLabel:'Town or city',
    placeholder:'e.g. Glasgow',
    description:'Search a place and use live weather data in your app.',
    resultKind:'single',
    resultHint:'One search gives one weather result. Use Labels, Text boxes or an Image to show its fields; a List can also show that one result.',
    listDefaults:{layout:'title-subtitle',image:'',title:'place',subtitle:'conditions'},
    fields:[
      ['place','Place','text'],['country','Country','text'],['temperature','Temperature °C','text'],['feelsLike','Feels like °C','text'],['conditions','Conditions','text'],['windSpeed','Wind speed km/h','text']
    ]
  },
  books: {
    id:'books',
    name:'Book Search',
    emoji:'📚',
    provider:'Open Library',
    queryLabel:'Book, author or topic',
    placeholder:'e.g. Harry Potter',
    description:'Search Open Library and use several matching books in your app.',
    resultKind:'multiple',
    resultHint:'One search can give several books. This works especially well with a List component.',
    listDefaults:{layout:'image-title-subtitle',image:'coverUrl',title:'title',subtitle:'author'},
    fields:[
      ['title','Book title','text'],['author','Author','text'],['year','First published','text'],['coverUrl','Cover image','image']
    ]
  },
  pokemon: {
    id:'pokemon',
    name:'Pokédex',
    emoji:'⚡',
    provider:'PokéAPI',
    queryLabel:'Pokémon name, number or type',
    placeholder:'e.g. pikachu, electric or all',
    description:'Find one Pokémon by name/number, or browse several by type.',
    resultKind:'mixed',
    resultHint:'Search a name/number for one Pokémon, a type such as electric/fire/water for several rows, or type all to browse a starter set.',
    listDefaults:{layout:'image-title-subtitle',image:'imageUrl',title:'name',subtitle:'types'},
    fields:[
      ['name','Name','text'],['number','Pokédex number','text'],['types','Type(s)','text'],['heightM','Height (m)','text'],['weightKg','Weight (kg)','text'],['imageUrl','Artwork image','image']
    ]
  }
};

export function apiServiceInfo(id){return API_CATALOG[id]||API_CATALOG.weather;}
export function apiFieldOptions(id){return apiServiceInfo(id).fields.map(([value,label])=>[label,value]);}

function titleCase(text){return String(text||'').replace(/(^|[-\s])\w/g,m=>m.toUpperCase());}
function weatherDescription(code){
  const n=Number(code);
  if(n===0)return 'Clear sky';
  if([1,2].includes(n))return 'Partly cloudy';
  if(n===3)return 'Overcast';
  if([45,48].includes(n))return 'Fog';
  if([51,53,55,56,57].includes(n))return 'Drizzle';
  if([61,63,65,66,67].includes(n))return 'Rain';
  if([71,73,75,77].includes(n))return 'Snow';
  if([80,81,82].includes(n))return 'Rain showers';
  if([85,86].includes(n))return 'Snow showers';
  if([95,96,99].includes(n))return 'Thunderstorm';
  return 'Weather unavailable';
}
async function fetchJson(url, timeoutMs=10000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error(`The service replied with ${response.status}.`);
    return await response.json();
  }catch(err){
    if(err?.name==='AbortError')throw new Error('The API took too long to respond.');
    throw err;
  }finally{clearTimeout(timer)}
}
async function weatherLookup(query){
  const geo=await fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`);
  const place=geo?.results?.[0];
  if(!place)throw new Error('No matching place was found. Try a town or city name.');
  const data=await fetchJson(`https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(place.latitude)}&longitude=${encodeURIComponent(place.longitude)}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`);
  const current=data?.current;
  if(!current)throw new Error('Weather data was not available for that place.');
  return {
    place:place.name||query,
    country:place.country||'',
    temperature:Number(current.temperature_2m),
    feelsLike:Number(current.apparent_temperature),
    conditions:weatherDescription(current.weather_code),
    windSpeed:Number(current.wind_speed_10m)
  };
}
function mapBook(book){
  return {
    title:book?.title||'Untitled',
    author:Array.isArray(book?.author_name)?book.author_name.slice(0,3).join(', '):(book?.author_name||'Unknown'),
    year:book?.first_publish_year??'',
    coverUrl:book?.cover_i?`https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`:''
  };
}
async function bookSearch(query){
  const data=await fetchJson(`https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=12&fields=title,author_name,first_publish_year,cover_i,key`);
  const rows=(data?.docs||[]).slice(0,12).map(mapBook);
  if(!rows.length)throw new Error('No matching book was found. Try another title, author or topic.');
  return rows;
}
const POKEMON_TYPES=new Set(['normal','fire','water','electric','grass','ice','fighting','poison','ground','flying','psychic','bug','rock','ghost','dragon','dark','steel','fairy']);
function mapPokemon(data){
  return {
    name:titleCase(data?.name),
    number:data?.id??'',
    types:(data?.types||[]).map(x=>titleCase(x?.type?.name)).filter(Boolean).join(', '),
    heightM:Math.round((Number(data?.height)||0)*10)/100,
    weightKg:Math.round((Number(data?.weight)||0))/10,
    imageUrl:data?.sprites?.other?.['official-artwork']?.front_default||data?.sprites?.front_default||''
  };
}
async function pokemonLookup(query){
  const cleaned=String(query).trim().toLowerCase().replace(/\s+/g,'-');
  let data;
  try{data=await fetchJson(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(cleaned)}/`)}catch(err){if(String(err?.message||'').includes('404'))throw new Error('No matching Pokémon was found. Try a name, Pokédex number, type such as electric, or all.');throw err}
  if(!data?.name)throw new Error('No matching Pokémon was found.');
  return mapPokemon(data);
}
async function pokemonRowsFromNames(names){
  const unique=[...new Set((names||[]).filter(Boolean))].slice(0,12);
  const rows=(await Promise.all(unique.map(async name=>{
    try{return await pokemonLookup(name)}catch{return null}
  }))).filter(Boolean).sort((a,b)=>(Number(a.number)||99999)-(Number(b.number)||99999));
  if(!rows.length)throw new Error('No Pokémon could be loaded for that browse search.');
  return rows;
}
async function pokemonTypeSearch(type){
  let data;
  try{data=await fetchJson(`https://pokeapi.co/api/v2/type/${encodeURIComponent(type)}/`)}catch(err){if(String(err?.message||'').includes('404'))throw new Error('That Pokémon type was not found. Try electric, fire, water, grass or another type.');throw err}
  const names=(data?.pokemon||[]).map(x=>x?.pokemon?.name).filter(Boolean);
  return pokemonRowsFromNames(names);
}
async function pokemonBrowseAll(){
  const data=await fetchJson('https://pokeapi.co/api/v2/pokemon?limit=12&offset=0');
  return pokemonRowsFromNames((data?.results||[]).map(x=>x?.name));
}

export async function fetchApiResponse(serviceId, query){
  const q=String(query??'').trim();
  if(!q)throw new Error('Enter something to search for first.');
  if(serviceId==='books'){
    const rows=await bookSearch(q);
    return {primary:rows[0],rows};
  }
  if(serviceId==='pokemon'){
    const cleaned=q.toLowerCase().trim();
    if(cleaned==='all'||cleaned==='browse'||cleaned==='list'){
      const rows=await pokemonBrowseAll();
      return {primary:rows[0],rows};
    }
    if(POKEMON_TYPES.has(cleaned)){
      const rows=await pokemonTypeSearch(cleaned);
      return {primary:rows[0],rows};
    }
    const primary=await pokemonLookup(q);
    return {primary,rows:[primary]};
  }
  const primary=await weatherLookup(q);
  return {primary,rows:[primary]};
}

export async function fetchApiData(serviceId, query){
  return (await fetchApiResponse(serviceId,query)).primary;
}
