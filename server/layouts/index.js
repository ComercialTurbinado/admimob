/**
 * layouts/index.js — Registro de layouts disponíveis.
 * Cada layout define um id, nome, tema e renderer com as 4 funções de página.
 */
import * as layout1 from './layout1.js';

export const LAYOUTS = [
  {
    id: 'layout0',
    name: 'Clássico Dark',
    description: 'Fundo escuro, tipografia serifada, minimalista. Layout padrão.',
    theme: 'dark',
  },
  {
    id: 'layout1',
    name: 'Azure Horizon',
    description: 'Editorial claro, glassmorphism, inspirado em revistas de arquitetura.',
    theme: 'light',
    renderer: layout1,
  },
];

/** Retorna o layout pelo id (ou o layout0 padrão, que usa o fluxo existente em catalog.js). */
export function getLayout(layoutId) {
  return LAYOUTS.find((l) => l.id === layoutId) || LAYOUTS[0];
}
