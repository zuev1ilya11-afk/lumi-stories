import { describe, expect, it } from 'vitest';
import type { ProgressDto } from '../api/types';
import { getScene } from '../story/engine';
import { getEpisode } from '../story/episodes';
import { normalizeEpisode2Progress } from './legacyEpisode2';

const episode = getEpisode('last-online-s1-e2');
const initial: ProgressDto = { storyId: 'last-online', seasonId: 'season-1', episodeId: episode.id, sceneId: 'ep2_last_call', junhoScore: 9, taeyunScore: 7, truthScore: 5, riskScore: 3, flags: { photo_saved: true, trusted_junho_warning: true, taeyun_told_sim: true, showed_taeyun_photo: true, custom: 'keep', count: 2, denied: false } };

// Checkpoints published in 8f23ce9: result scenes resume after their already-saved choices.
const legacyScenes = [
  ['ep2_morning_after', 'ep2_morning'], ['ep2_morning_branch', 'ep2_morning'],
  ['ep2_junho_call', 'ep2_morning_called'], ['ep2_soa_after_reply', 'ep2_morning_replied'], ['ep2_quiet_morning', 'ep2_morning_saved'],
  ['ep2_campus_notice', 'ep2_mina'], ['ep2_event_hall', 'ep2_event'], ['ep2_backstage_task', 'ep2_call'],
  ['ep2_taeyun_number', 'ep2_recognized'], ['ep2_choice_number', 'ep2_recognized'],
  ['ep2_number_truth_result', 'ep2_phone_truth'], ['ep2_number_press_result', 'ep2_phone_demand'], ['ep2_number_lie_result', 'ep2_phone_lie'],
  ['ep2_live_interrupt', 'ep2_last_call'], ['ep2_practice_invite', 'ep2_last_call'], ['ep2_practice_room', 'ep2_photo_choice'],
  ['ep2_choice_photo', 'ep2_photo_choice'], ['ep2_photo_full_result', 'ep2_photo_full'], ['ep2_photo_crop_result', 'ep2_photo_pendant'], ['ep2_photo_hide_result', 'ep2_photo_refuse'],
  ['ep2_last_call', 'ep2_soa_incoming'], ['ep2_soa_warning', 'ep2_soa_incoming'], ['ep2_choice_archive', 'ep2_archive_choice'],
  ['ep2_archive_with_taeyun', 'ep2_archive_taeyun'], ['ep2_archive_with_mina', 'ep2_archive_mina'], ['ep2_archive_ask_soa', 'ep2_archive_soa'],
  ['ep2_archive_result', 'ep2_archive_permission'], ['ep2_security_frame', 'ep2_archive_0226'],
  ['ep2_rooftop', 'ep2_rooftop'], ['ep2_choice_rooftop', 'ep2_rooftop_choice'],
  ['ep2_roof_trust_result', 'ep2_rooftop_believe'], ['ep2_roof_challenge_result', 'ep2_rooftop_suspect'], ['ep2_roof_junho_result', 'ep2_rooftop_junho'],
  ['ep2_keycard', 'ep2_card_intro'], ['ep2_choice_keycard', 'ep2_card_choice'],
  ['ep2_key_take_result', 'ep2_card_take'], ['ep2_key_refuse_result', 'ep2_card_refuse'], ['ep2_key_junho_result', 'ep2_card_send'],
  ['ep2_elevator', 'ep2_lift_checkpoint'], ['ep2_junho_arrives', 'ep2_confrontation'], ['ep2_end', 'ep2_end'],
] as const;

describe('published episode 2 progress compatibility', () => {
  it.each(legacyScenes)('resumes published %s at %s without replaying effects', (sceneId, expected) => {
    const before = { ...initial, sceneId };
    const normalized = normalizeEpisode2Progress(before, episode)!;
    expect(normalized.sceneId).toBe(expected);
    expect(getScene(episode, normalized.sceneId)).toBeDefined();
    expect(normalized).toMatchObject({ ...before, sceneId: expected });
    expect(normalized.flags).toMatchObject({ ...before.flags, ep2_legacy_normalized: true });
    expect(before.flags).not.toHaveProperty('ep2_legacy_normalized');
    expect(normalizeEpisode2Progress(normalized, episode)).toBe(normalized);
  });

  it.each([
    ['taeyun_told_sim', 'ep2_phone_response', 'truth'], ['pressed_taeyun_number', 'ep2_phone_response', 'demand'], ['lied_taeyun_number', 'ep2_phone_response', 'lie'],
    ['showed_taeyun_photo', 'ep2_photo_evidence', 'full'], ['showed_taeyun_crop', 'ep2_photo_evidence', 'pendant'], ['hid_photo_from_taeyun', 'ep2_photo_evidence', 'refuse'],
    ['went_archive_taeyun', 'ep2_archive_partner', 'taeyun'], ['asked_mina_archive', 'ep2_archive_partner', 'mina'], ['asked_soa_archive', 'ep2_archive_partner', 'soa'],
    ['trusted_taeyun', 'ep2_rooftop_response', 'believe'], ['challenged_taeyun', 'ep2_rooftop_response', 'suspect'], ['warned_junho_about_taeyun', 'ep2_rooftop_response', 'junho'],
    ['took_b17_keycard', 'ep2_card_response', 'take'], ['photographed_b17_keycard', 'ep2_card_response', 'refuse'], ['sent_keycard_junho', 'ep2_card_response', 'send'],
  ])('translates %s into %s=%s while preserving the original flag', (legacy, current, value) => {
    const before = { ...initial, sceneId: 'ep2_end', flags: { photo_saved: true, [legacy]: true } };
    expect(normalizeEpisode2Progress(before, episode)!.flags).toEqual({ ...before.flags, [current]: value, ep2_legacy_normalized: true });
  });

  it('does not treat current last_call as the legacy post-photo checkpoint', () => {
    const current = { ...initial, flags: { ...initial.flags, ep2_phone_response: 'truth' } };
    expect(normalizeEpisode2Progress(current, episode)).toBe(current);
    const withoutOldFlags = { ...initial, flags: { photo_saved: true } };
    expect(normalizeEpisode2Progress(withoutOldFlags, episode)).toBe(withoutOldFlags);
  });

  it('keeps current response flags intact when translating an old scene ID', () => {
    const current = { ...initial, sceneId: 'ep2_number_truth_result', flags: { ...initial.flags, ep2_phone_response: 'demand' } };
    expect(normalizeEpisode2Progress(current, episode)!.flags.ep2_phone_response).toBe('demand');
  });

  it('never overwrites any existing flag when mapping a legacy-only scene', () => {
    const current = { ...initial, sceneId: 'ep2_number_truth_result', flags: { ...initial.flags, ep2_legacy_normalized: 'retained-value' } };
    expect(normalizeEpisode2Progress(current, episode)!.flags).toMatchObject(current.flags);
  });

  it('accepts the provisional episode alias without adding a legacy marker to current progress', () => {
    const current = { ...initial, episodeId: 'episode-2', sceneId: 'ep2_morning', flags: { photo_saved: true } };
    expect(normalizeEpisode2Progress(current, episode)).toEqual({ ...current, episodeId: episode.id });
  });

  it('leaves episode 1, absent progress, and unknown scenes unchanged', () => {
    const first = { ...initial, episodeId: 'last-online-s1-e1', sceneId: 'ep1_end_paywall' };
    expect(normalizeEpisode2Progress(first, episode)).toBe(first);
    expect(normalizeEpisode2Progress(null, episode)).toBeNull();
    const unknown = { ...initial, sceneId: 'ep2_missing' };
    expect(normalizeEpisode2Progress(unknown, episode)).toBe(unknown);
  });
});
