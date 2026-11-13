"""Keeps single trees off the roads.

The tree points come from laser scanning and mark the top of each crown. Where a tree leans
or spreads over a street, that point lands on the carriageway although the trunk stands on
the verge. Such trees are moved to the nearest clear spot beside the road if one is within
reach of the crown, and dropped otherwise.
"""
import numpy as np
from scipy import ndimage
from scipy.spatial import cKDTree

PAVED, GRAVEL, WATER = 1, 2, 4
VERGE = 1.5            # distance a moved trunk keeps from the road edge (m)
BLOCK = 1024           # working tile (cells)
PAD = 24


def clear_roads(T, surf, x0, z0, blocked=None):
    """T: (n,5+) x, z, height, crown diameter, ...; surf: 1 m surface classes with cell
    [r, c] at x0 + c, z0 + r; blocked: optional mask of cells no tree may be moved to.

    Returns (trees, moved): the trees that remain, and a mask of those that were moved.
    """
    hgt, wid = surf.shape
    r = np.clip((T[:, 1] - z0).astype(int), 0, hgt - 1)
    c = np.clip((T[:, 0] - x0).astype(int), 0, wid - 1)
    on = np.isin(surf[r, c], (PAVED, GRAVEL))
    T = T.copy()
    keep = np.ones(len(T), bool)
    moved = np.zeros(len(T), bool)
    for br in np.unique(r[on] // BLOCK):
        for bc in np.unique(c[on & (r // BLOCK == br)] // BLOCK):
            ra, rb = max(br * BLOCK - PAD, 0), min((br + 1) * BLOCK + PAD, hgt)
            ca, cb = max(bc * BLOCK - PAD, 0), min((bc + 1) * BLOCK + PAD, wid)
            s = surf[ra:rb, ca:cb]
            road = (s == PAVED) | (s == GRAVEL)
            free = (ndimage.distance_transform_edt(~road) >= VERGE) & (s != WATER)
            if blocked is not None:
                free &= ~blocked[ra:rb, ca:cb]
            if not free.any():
                keep[on & (r // BLOCK == br) & (c // BLOCK == bc)] = False
                continue
            dist, (ir, ic) = ndimage.distance_transform_edt(~free, return_indices=True)
            for i in np.nonzero(on & (r // BLOCK == br) & (c // BLOCK == bc))[0]:
                lr, lc = r[i] - ra, c[i] - ca
                if dist[lr, lc] > np.clip(T[i, 3] / 2 + 1.5, 3.0, 7.0):
                    keep[i] = False
                    continue
                T[i, 0] = x0 + ca + ic[lr, lc] + 0.5
                T[i, 1] = z0 + ra + ir[lr, lc] + 0.5
                moved[i] = True
    # a moved tree must not crowd a tree that was already there, or another moved one
    stay = keep & ~moved
    if moved.any() and stay.any():
        d, _ = cKDTree(T[stay][:, :2]).query(T[moved][:, :2])
        idx = np.nonzero(moved)[0][d < 2.5]
        keep[idx] = False
        moved[idx] = False
    idx = np.nonzero(moved)[0]
    idx = idx[np.argsort(-T[idx, 2])]                       # tallest first
    if len(idx) > 1:
        near = cKDTree(T[idx][:, :2]).query_ball_point(T[idx][:, :2], 2.5)
        kept = np.zeros(len(idx), bool)
        for k, nb in enumerate(near):
            kept[k] = not kept[nb].any()
        keep[idx[~kept]] = False
        moved[idx[~kept]] = False
    return T[keep], moved[keep]
