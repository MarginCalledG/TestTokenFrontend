#!/usr/bin/env python3
"""Regenerate src/abi/*.ts from the Foundry artifacts of the contracts repo (MarginCalledG/TestToken).
Usage: python3 scripts/gen-abi.py <path-to-contracts-repo>/out   (run `forge build` there first)."""
import json, os, sys
root = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', '..', 'testtoken', 'out')
here = os.path.join(os.path.dirname(__file__), '..', 'src', 'abi')
for c, name in [('Higher','higherAbi'),('CaymanIslands','caymanAbi'),('IRSAgent','irsAgentAbi'),('TwapOracle','twapOracleAbi'),('HashChainSeed','seedAbi')]:
    abi = json.load(open(f'{root}/{c}.sol/{c}.json'))['abi']
    with open(f'{here}/{c}.ts', 'w') as f:
        f.write(f"// Generated from the {c} Foundry artifact. Do not edit by hand.\n// Regenerate: frontend/scripts/gen-abi.py (reads ../out/{c}.sol/{c}.json)\n\nexport const {name} = {json.dumps(abi, indent=2)} as const\n")
