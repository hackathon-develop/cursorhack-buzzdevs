import os
import django
from django.utils import timezone
from home.models import HomePage
from advertisements.models import AdIndexPage, AdPage

# Get homepage
home = HomePage.objects.first()
if home:
    # Check if AdIndexPage exists
    ad_index = AdIndexPage.objects.child_of(home).first()
    if not ad_index:
        ad_index = AdIndexPage(
            title="Featured Campaigns",
            intro='<div class="rich-text">Discover the most innovative startups raising capital today.</div>',
            slug="campaigns"
        )
        home.add_child(instance=ad_index)
        ad_index.save_revision().publish()
        print("Created AdIndexPage 'campaigns'")
    else:
        print("AdIndexPage already exists")

    # Create dummy ads
    if not AdPage.objects.child_of(ad_index).exists():
        ad1 = AdPage(
            title="Nebula AI",
            body='<div class="rich-text"><p>Pioneering the future of generative neural networks for deep space exploration.</p></div>',
            target_audience="Tech Investors",
            cta_text="Seed Round Open",
            cta_url="https://example.com",
            date=timezone.now(),
            slug="nebula-ai"
        )
        ad_index.add_child(instance=ad1)
        ad1.save_revision().publish()
        
        ad2 = AdPage(
            title="GreenVolt",
            body='<div class="rich-text"><p>Sustainable energy storage solutions for the modern grid. High efficiency, low impact.</p></div>',
            target_audience="Green Energy",
            cta_text="View Prototype",
            cta_url="https://example.com",
            date=timezone.now(),
            slug="greenvolt"
        )
        ad_index.add_child(instance=ad2)
        ad2.save_revision().publish()
        
        ad3 = AdPage(
            title="Quantum Fin",
            body='<div class="rich-text"><p>Quantum computing algorithms for high-frequency trading.</p></div>',
            target_audience="Fintech",
            cta_text="Request deck",
            cta_url="https://example.com",
            date=timezone.now(),
            slug="quantum-fin"
        )
        ad_index.add_child(instance=ad3)
        ad3.save_revision().publish()
        print("Created sample AdPages")
    else:
        print("Sample ads already exist")
else:
    print("No HomePage found")
