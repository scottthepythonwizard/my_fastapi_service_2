"""Explainable fit heuristics, blended with actual community votes; no external calls."""
from math import floor

US_TO_EU = {4: 36, 4.5: 36.5, 5: 37.5, 5.5: 38, 6: 38.5, 6.5: 39, 7: 40, 7.5: 40.5,
            8: 41, 8.5: 42, 9: 42.5, 9.5: 43, 10: 44, 10.5: 44.5, 11: 45, 11.5: 45.5,
            12: 46, 12.5: 47, 13: 47.5, 13.5: 48, 14: 48.5, 14.5: 49, 15: 49.5, 15.5: 50, 16: 50.5}


def half_size(value):
    return floor(value * 2 + 0.5) / 2


def normalize_size(value, system):
    if system == 'eu':
        matches = [us for us, eu in US_TO_EU.items() if eu == value]
        if not matches:
            raise ValueError('Choose an EU size available in the sizing menu.')
        return matches[0]
    us = value - 1.5 if system == 'us_women' else value
    if us not in US_TO_EU:
        raise ValueError('Use a half-step size between US men\'s 4–16 (women\'s 5.5–17.5).')
    return us


def fit_profile(item, stats):
    shoe = item['attributes']
    materials = shoe['materials'].lower()
    cushioning = shoe['cushioning'].lower()
    notes = []
    offset = 0.0
    width = 0.0
    if shoe['cut'] == 'High':
        offset += .05
        notes.append('High collar: secure ankle entry; collar height alone does not establish toe length.')
    elif shoe['cut'] == 'Mid':
        notes.append('Mid collar adds ankle hold; check collar comfort as well as toe room.')
    else:
        notes.append('Low cut leaves the ankle free; heel lockdown depends on the upper and closure.')
    if 'leather' in materials or 'synthetic' in materials:
        offset += .10
        width -= .15
        notes.append('Leather/synthetic panels may feel firm across the forefoot before break-in.')
    if 'knit' in materials or 'mesh' in materials:
        offset -= .05
        notes.append('Knit/mesh can adapt over the foot; this does not guarantee a wide last.')
    if shoe['closure_type'] == 'Laceless':
        offset += .10
        width -= .20
        notes.append('Laceless construction offers less adjustment over a high instep.')
    else:
        notes.append('Laces allow tension adjustment over the instep without changing the shoe length.')
    if any(tag in cushioning for tag in ('boost', 'fresh foam', 'ortholite')):
        offset += .05
        notes.append(f"{shoe['cushioning']} adds underfoot comfort; the footbed can reduce internal volume.")
    else:
        notes.append(f"Cushioning: {shoe['cushioning']}; cushioning is not a direct measure of last length.")
    if shoe['category'] == 'Football':
        offset += .20
        width -= .50
        notes.append('Close-fitting upper and rigid studded soleplate: a wider foot may need more room or a wider model.')
    if shoe['brand'] == 'Converse':
        offset -= .50
        width -= .25
        notes.append('Converse canvas silhouette: preliminary longer-length baseline, not a measurement of this pair.')
    votes = stats['total_votes']
    fit_counts = stats['length_distribution']['counts']
    width_counts = stats['width_distribution']['counts']
    # shortcut: structural priors are estimates, not model-specific last measurements; calibrate with size-qualified votes.
    blend = votes / (votes + 8)
    length_vote = .5 * (fit_counts['runs_small'] - fit_counts['runs_large']) / votes if votes else 0
    width_vote = (width_counts['wide'] - width_counts['narrow']) / votes if votes else 0
    offset = (1 - blend) * max(-.5, min(.5, offset)) + blend * length_vote
    width = (1 - blend) * width + blend * width_vote
    length_label = 'Runs Small' if offset > .17 else 'Runs Large' if offset < -.17 else 'True to Size'
    width_label = 'Narrow' if width < -.25 else 'Wide' if width > .25 else 'Standard'
    return {'id': item['id'], 'name': f"{shoe['brand']} {shoe['name']}", 'length_offset': round(offset, 4),
            'width_score': round(width, 4), 'length_profile': length_label, 'width_profile': width_label,
            'structural_notes': notes, 'community': stats, 'basis': 'Community + structural estimate' if votes else 'Structural estimate; no community votes'}


def recommend(reference, target, reference_size, system, foot_width, reference_stats, target_stats):
    baseline = normalize_size(reference_size, system)
    left = fit_profile(reference, reference_stats)
    right = fit_profile(target, target_stats)
    same = reference['id'] == target['id']
    width_multiplier = .35 if foot_width == 'wide' else -.15 if foot_width == 'narrow' else 0
    width_adjustment = width_multiplier * (left['width_score'] - right['width_score'])
    offset = 0.0 if same else half_size(max(-1, min(1, right['length_offset'] - left['length_offset'] + width_adjustment)))
    target_us = baseline + offset
    if target_us not in US_TO_EU:
        raise ValueError('The recommendation is outside the supported size range. Do not extrapolate this result.')
    samples = min(reference_stats['total_votes'], target_stats['total_votes'])
    dominant = lambda stats: max(stats['length_distribution']['counts'].values()) / stats['total_votes'] if stats['total_votes'] else 0
    agreement = min(dominant(reference_stats), dominant(target_stats))
    confidence = 'high' if same or (samples >= 30 and agreement >= .75) else 'medium' if samples >= 10 and agreement >= .6 else 'low'
    reason = ("Same shoe: keep your known comfortable size." if same else
              f"{right['name']} is estimated {right['length_profile'].lower()} / {right['width_profile'].lower()} versus "
              f"{left['length_profile'].lower()} / {left['width_profile'].lower()} for your reference. "
              f"The relative adjustment is {offset:+g} US sizes, including your {foot_width} foot-width preference.")
    if not same and samples < 10:
        reason += ' Limited community evidence: treat this as a starting point, not a guaranteed fit.'
    value = US_TO_EU[target_us] if system == 'eu' else target_us + 1.5 if system == 'us_women' else target_us
    return {'reference_shoe_id': reference['id'], 'target_shoe_id': target['id'], 'reference_size': reference_size,
            'size_system': system, 'recommended_size': value, 'recommended_us_men': target_us,
            'recommended_us_women': target_us + 1.5, 'recommended_eu': US_TO_EU[target_us],
            'offset_us': offset, 'confidence': confidence, 'reason': reason,
            'conversion_note': 'EU equivalents are approximate generic conversions; manufacturer size charts and lasts vary.',
            'reference_profile': left, 'target_profile': right}
