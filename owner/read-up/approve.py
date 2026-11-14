"""Trusted LOCAL review action; never exposed through an HTTP route.

--approve attests facts, exact selection, editorial quality, privacy and rights.
Read the actual articles and bundle before invoking. No automated fact check.
"""
import argparse
from datetime import datetime
from server import HOME,atomic,contract,read,encode,digest

def approve(job,reviewer,home=HOME):
    if not __import__('re').fullmatch(r'job-[a-f0-9]{24}',job):raise ValueError('Invalid job ID')
    folder=home/'outbox'/job;r=read(folder/'record.json');evidence=read(folder/'evidence.json')
    receipt={'record_sha256':digest(encode(r)),'evidence_sha256':digest(encode(evidence)),
             'approved_at':datetime.now(contract.SGT).isoformat(timespec='seconds'),'reviewer':reviewer,
             'checks':dict.fromkeys(('facts','exact_selection','privacy','rights','editorial'),True)}
    contract.review(r,evidence,receipt);atomic(folder/'review.json',encode(receipt));return job

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--job',required=True);p.add_argument('--reviewer',required=True);p.add_argument('--approve',action='store_true',required=True);a=p.parse_args();print('Approved exact local bundle '+approve(a.job,a.reviewer)+'. Return to the owner desk and click Publish.')
