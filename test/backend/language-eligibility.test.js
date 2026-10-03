import { describe, expect, it } from 'vitest';
import { englishEvidenceEligibility } from '../../backend/src/research/language-eligibility.js';

const englishAbstract = 'Anion exchange membranes are promising separators for alkaline electrochemical devices. This study evaluates chemical degradation pathways, polymer backbone stability, cation durability, water uptake, conductivity, and strategies that improve long-term operation under strongly alkaline conditions.';
const spanishAscii = 'Las membranas de intercambio anionico son materiales importantes para dispositivos electroquimicos alcalinos. Este estudio analiza la estabilidad quimica, la degradacion del polimero, la conductividad ionica y diferentes estrategias para mejorar el funcionamiento durante exposiciones prolongadas en condiciones alcalinas.';
const frenchAscii = 'Les membranes echangeuses anioniques sont importantes pour les dispositifs electrochimiques alcalins. Cette etude examine la stabilite chimique, la degradation du polymere, la conductivite ionique et plusieurs strategies pour ameliorer le fonctionnement pendant une exposition prolongee en milieu alcalin.';
const germanAscii = 'Anionenaustauschmembranen sind wichtige Materialien fuer alkalische elektrochemische Systeme. Diese Studie untersucht die chemische Stabilitaet, den Abbau des Polymers, die ionische Leitfaehigkeit und verschiedene Strategien zur Verbesserung des langfristigen Betriebs unter alkalischen Bedingungen.';

describe('Research evidence language eligibility', () => {
  it('trusts explicit English provider metadata', () => {
    expect(englishEvidenceEligibility({ language: 'en', title: 'Short' })).toMatchObject({ eligible: true, basis: 'provider_en' });
  });

  it('rejects explicit non-English provider metadata', () => {
    expect(englishEvidenceEligibility({ language: 'tr', title: 'English-looking title' }).eligible).toBe(false);
  });

  it('recovers sufficiently long English evidence when provider language metadata is absent', () => {
    expect(englishEvidenceEligibility({ language: null, title: 'Alkaline stability of anion exchange membranes', abstract: englishAbstract })).toMatchObject({ eligible: true, basis: 'detected_en' });
  });

  it.each([
    ['fuel-cell durability', 'Proton exchange membrane fuel cells require durable electrocatalysts and ionomers for long-term operation. Accelerated stress testing reveals degradation mechanisms involving platinum dissolution, carbon corrosion, membrane thinning, radical attack, and catalyst layer restructuring under automotive duty cycles.'],
    ['water electrolysis', 'Water electrolysis using polymer electrolyte membranes enables production of renewable hydrogen at high current density. Recent studies investigate iridium oxide oxygen evolution catalysts, porous transport layers, membrane electrode assemblies, mass transport limitations, efficiency losses, and durability during dynamic operation.'],
    ['battery materials', 'Lithium sulfur batteries offer high theoretical specific energy but practical performance is limited by polysulfide dissolution, sluggish conversion kinetics, lithium metal instability, and electrolyte consumption. Composite sulfur cathodes and functional separators can improve cycling stability and active material utilization.'],
    ['anion-exchange chemistry', 'Alkaline anion exchange membranes transport hydroxide ions through hydrated polymer domains. Molecular design strategies include stable cationic groups, sterically protected backbones, controlled crosslinking, phase-separated morphologies, and reduced water swelling while maintaining useful ionic conductivity.']
  ])('accepts diverse scientific English prose with missing provider metadata: %s', (_topic, abstract) => {
    expect(englishEvidenceEligibility({ language: null, title: 'Scientific study', abstract }).eligible).toBe(true);
  });

  it.each([
    ['Spanish', spanishAscii],
    ['French', frenchAscii],
    ['German', germanAscii]
  ])('rejects ASCII-normalized %s evidence with missing provider metadata', (_language, abstract) => {
    expect(englishEvidenceEligibility({ language: null, title: 'Alkaline membrane stability', abstract }).eligible).toBe(false);
  });

  it('fails closed for short evidence with unknown language', () => {
    expect(englishEvidenceEligibility({ language: null, title: 'Alkaline membrane stability', abstract: null })).toMatchObject({ eligible: false, basis: 'insufficient_text' });
  });
});
