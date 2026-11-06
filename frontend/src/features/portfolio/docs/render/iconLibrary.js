// Biblioteca de iconos e ilustraciones. Se carga bajo demanda desde el selector de iconos.

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Activity, AlarmClock, AlertTriangle, Archive, ArrowRight, Award, BarChart3, Battery, Bell, Bike, Book, Bookmark, Brain, Briefcase, Bug, Building2,
  Calendar, Camera, Car, Check, CheckCircle2, ChefHat, ClipboardList, Clock, Cloud, Code2, Coffee, Cog, Compass, Cpu, CreditCard, Crown, Database,
  DollarSign, Download, Droplet, Earth, Edit3, Eye, Factory, FileText, Film, Filter, Flag, Flame, FlaskConical, Folder, Gamepad2, Gift, GitBranch,
  Globe, GraduationCap, Hammer, Handshake, HardDrive, Headphones, Heart, HelpCircle, Home, Hourglass, Image, Inbox, Key, Laptop, Layers, Leaf,
  Lightbulb, Link, List, Lock, Mail, Map, MapPin, Megaphone, MessageCircle, Mic, Monitor, Moon, Mountain, Music, Package, Paperclip, PenTool,
  Phone, PieChart, Plane, Plug, Printer, Puzzle, Rocket, Scale, School, Search, Send, Server, Settings, Share2, Shield, ShoppingCart, Smartphone,
  Smile, Sparkles, Star, Sun, Tag, Target, Terminal, ThumbsUp, Timer, Trash2, TrendingUp, Trophy, Truck, Umbrella, Upload, User, Users, Video,
  Wallet, Wifi, Wrench, Zap,
} from 'lucide-react';

const ICONS = {
  Activity: 'actividad pulso salud', AlarmClock: 'alarma reloj', AlertTriangle: 'alerta advertencia', Archive: 'archivo caja', ArrowRight: 'flecha derecha',
  Award: 'premio medalla', BarChart3: 'grafico barras metricas', Battery: 'bateria', Bell: 'campana notificacion', Bike: 'bicicleta', Book: 'libro',
  Bookmark: 'marcador', Brain: 'cerebro idea', Briefcase: 'maletin trabajo', Bug: 'bug error', Building2: 'edificio empresa', Calendar: 'calendario fecha',
  Camera: 'camara foto', Car: 'auto coche', Check: 'check ok', CheckCircle2: 'completado ok', ChefHat: 'cocina chef', ClipboardList: 'lista tareas',
  Clock: 'reloj tiempo', Cloud: 'nube', Code2: 'codigo programacion', Coffee: 'cafe', Cog: 'engranaje', Compass: 'brujula', Cpu: 'procesador chip',
  CreditCard: 'tarjeta pago', Crown: 'corona', Database: 'base de datos', DollarSign: 'dinero dolar', Download: 'descargar', Droplet: 'gota agua',
  Earth: 'tierra mundo', Edit3: 'editar lapiz', Eye: 'ojo ver', Factory: 'fabrica', FileText: 'documento archivo', Film: 'pelicula video', Filter: 'filtro',
  Flag: 'bandera meta', Flame: 'fuego', FlaskConical: 'laboratorio ciencia', Folder: 'carpeta', Gamepad2: 'juego', Gift: 'regalo', GitBranch: 'git rama',
  Globe: 'globo web', GraduationCap: 'educacion graduacion', Hammer: 'martillo', Handshake: 'acuerdo trato', HardDrive: 'disco', Headphones: 'audifonos',
  Heart: 'corazon', HelpCircle: 'ayuda pregunta', Home: 'casa inicio', Hourglass: 'reloj arena', Image: 'imagen', Inbox: 'bandeja', Key: 'llave',
  Laptop: 'laptop computadora', Layers: 'capas', Leaf: 'hoja planta', Lightbulb: 'idea bombilla', Link: 'enlace', List: 'lista', Lock: 'candado seguridad',
  Mail: 'correo email', Map: 'mapa', MapPin: 'ubicacion', Megaphone: 'anuncio', MessageCircle: 'mensaje chat', Mic: 'microfono', Monitor: 'monitor pantalla',
  Moon: 'luna noche', Mountain: 'montaña', Music: 'musica', Package: 'paquete', Paperclip: 'clip adjunto', PenTool: 'pluma diseño', Phone: 'telefono',
  PieChart: 'grafico circular', Plane: 'avion viaje', Plug: 'enchufe', Printer: 'impresora', Puzzle: 'rompecabezas', Rocket: 'cohete lanzamiento',
  Scale: 'balanza', School: 'escuela', Search: 'buscar lupa', Send: 'enviar', Server: 'servidor', Settings: 'configuracion ajustes', Share2: 'compartir',
  Shield: 'escudo seguridad', ShoppingCart: 'carrito compra', Smartphone: 'celular movil', Smile: 'sonrisa', Sparkles: 'brillos magia ia', Star: 'estrella',
  Sun: 'sol', Tag: 'etiqueta', Target: 'objetivo diana', Terminal: 'terminal consola', ThumbsUp: 'me gusta', Timer: 'temporizador', Trash2: 'basura eliminar',
  TrendingUp: 'tendencia crecimiento', Trophy: 'trofeo', Truck: 'camion envio', Umbrella: 'paraguas', Upload: 'subir', User: 'usuario persona',
  Users: 'equipo personas', Video: 'video', Wallet: 'billetera', Wifi: 'wifi', Wrench: 'llave herramienta', Zap: 'rayo energia',
};

const COMPONENTS = {
  Activity, AlarmClock, AlertTriangle, Archive, ArrowRight, Award, BarChart3, Battery, Bell, Bike, Book, Bookmark, Brain, Briefcase, Bug, Building2,
  Calendar, Camera, Car, Check, CheckCircle2, ChefHat, ClipboardList, Clock, Cloud, Code2, Coffee, Cog, Compass, Cpu, CreditCard, Crown, Database,
  DollarSign, Download, Droplet, Earth, Edit3, Eye, Factory, FileText, Film, Filter, Flag, Flame, FlaskConical, Folder, Gamepad2, Gift, GitBranch,
  Globe, GraduationCap, Hammer, Handshake, HardDrive, Headphones, Heart, HelpCircle, Home, Hourglass, Image, Inbox, Key, Laptop, Layers, Leaf,
  Lightbulb, Link, List, Lock, Mail, Map, MapPin, Megaphone, MessageCircle, Mic, Monitor, Moon, Mountain, Music, Package, Paperclip, PenTool,
  Phone, PieChart, Plane, Plug, Printer, Puzzle, Rocket, Scale, School, Search, Send, Server, Settings, Share2, Shield, ShoppingCart, Smartphone,
  Smile, Sparkles, Star, Sun, Tag, Target, Terminal, ThumbsUp, Timer, Trash2, TrendingUp, Trophy, Truck, Umbrella, Upload, User, Users, Video,
  Wallet, Wifi, Wrench, Zap,
};

export function listIcons(query = '') {
  const needle = query.trim().toLowerCase();
  return Object.keys(ICONS).filter((name) => !needle || name.toLowerCase().includes(needle) || ICONS[name].includes(needle));
}

export function iconSvg(name, strokeWidth = 2) {
  const Component = COMPONENTS[name];
  if (!Component) return '';
  return renderToStaticMarkup(createElement(Component, { size: '100%', strokeWidth, color: 'currentColor' }));
}

export const ILLUSTRATIONS = {
  team: { label: 'Equipo', svg: '<svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="140" rx="16" fill="#eaf6f1"/><circle cx="60" cy="58" r="18" fill="#2f6f5e"/><rect x="38" y="80" width="44" height="40" rx="18" fill="#2f6f5e"/><circle cx="100" cy="50" r="20" fill="#67bfa1"/><rect x="76" y="74" width="48" height="46" rx="20" fill="#67bfa1"/><circle cx="140" cy="58" r="18" fill="#f8c76b"/><rect x="118" y="80" width="44" height="40" rx="18" fill="#f8c76b"/></svg>' },
  growth: { label: 'Crecimiento', svg: '<svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="140" rx="16" fill="#f6f1e8"/><rect x="30" y="90" width="24" height="30" rx="4" fill="#b7e4d4"/><rect x="66" y="70" width="24" height="50" rx="4" fill="#67bfa1"/><rect x="102" y="50" width="24" height="70" rx="4" fill="#2f6f5e"/><rect x="138" y="28" width="24" height="92" rx="4" fill="#1f4e43"/><path d="M30 80 L80 58 L112 40 L160 18" stroke="#f97316" stroke-width="4" fill="none" stroke-linecap="round"/></svg>' },
  idea: { label: 'Idea', svg: '<svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="140" rx="16" fill="#fff7e0"/><circle cx="100" cy="60" r="32" fill="#f8c76b"/><rect x="86" y="92" width="28" height="18" rx="4" fill="#64748b"/><path d="M100 14 V4 M58 30 L50 22 M142 30 L150 22 M46 62 H36 M154 62 H164" stroke="#f59e0b" stroke-width="4" stroke-linecap="round"/></svg>' },
  launch: { label: 'Lanzamiento', svg: '<svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="140" rx="16" fill="#e8eefc"/><path d="M100 18 C124 34 130 70 118 100 H82 C70 70 76 34 100 18 Z" fill="#4338ca"/><circle cx="100" cy="58" r="10" fill="#e0e7ff"/><path d="M82 100 L70 118 L88 108 Z M118 100 L130 118 L112 108 Z" fill="#7c3aed"/><path d="M92 104 L100 132 L108 104 Z" fill="#f97316"/></svg>' },
  data: { label: 'Datos', svg: '<svg viewBox="0 0 200 140" xmlns="http://www.w3.org/2000/svg"><rect width="200" height="140" rx="16" fill="#e6f6fb"/><ellipse cx="100" cy="36" rx="46" ry="14" fill="#0e7490"/><path d="M54 36 V100 C54 108 74 114 100 114 C126 114 146 108 146 100 V36" fill="#06b6d4"/><path d="M54 58 C54 66 74 72 100 72 C126 72 146 66 146 58 M54 80 C54 88 74 94 100 94 C126 94 146 88 146 80" stroke="#0e7490" stroke-width="3" fill="none"/></svg>' },
};
