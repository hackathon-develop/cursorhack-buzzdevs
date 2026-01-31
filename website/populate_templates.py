import os
import django
from django.utils import timezone
from home.models import HomePage
from ad_templates.models import TemplateIndexPage, TemplatePage, TemplateCategory

# Get homepage
home = HomePage.objects.first()
if home:
    # Check if TemplateIndexPage exists
    if not TemplateIndexPage.objects.child_of(home).exists():
        index_page = TemplateIndexPage(
            title="Templates",
            slug="templates",
            intro='<div class="rich-text">Discover our collection of premium ad templates.</div>'
        )
        home.add_child(instance=index_page)
        index_page.save_revision().publish()
        print("Created TemplateIndexPage 'templates'")
    else:
        index_page = TemplateIndexPage.objects.child_of(home).first()
        print("TemplateIndexPage already exists")

    # Create Categories
    # Industry
    industries = ['Fashion', 'Electronics', 'Sport and Recreation', 'Home and Garden', 'Health and Beauty']
    industry_objs = {}
    for name in industries:
        slug = name.lower().replace(' ', '-')
        obj, created = TemplateCategory.objects.get_or_create(
            name=name, 
            slug=slug, 
            category_type='industry'
        )
        industry_objs[name] = obj

    # Season
    seasons = ['Black Friday', 'Cyber Monday', 'Christmas', 'Summer Sale']
    season_objs = {}
    for name in seasons:
        slug = name.lower().replace(' ', '-')
        obj, created = TemplateCategory.objects.get_or_create(
            name=name, 
            slug=slug, 
            category_type='season'
        )
        season_objs[name] = obj

    # Style
    styles = ['Modern', 'Creative', 'Minimalist', 'Bold']
    style_objs = {}
    for name in styles:
        slug = name.lower().replace(' ', '-')
        obj, created = TemplateCategory.objects.get_or_create(
            name=name, 
            slug=slug, 
            category_type='style'
        )
        style_objs[name] = obj

    # Create dummy templates
    templates_data = [
        {
            "title": "Modern Vermilion Clear",
            "price": 199.00,
            "industries": ["Sport and Recreation"],
            "seasons": ["Summer Sale"],
            "styles": ["Modern", "Bold"],
            "desc": "A dynamic template for sports footwear and apparel."
        },
        {
            "title": "Tasty Red Boxed",
            "price": 49.00,
            "industries": ["Electronics"],
            "seasons": ["Black Friday"],
            "styles": ["Creative"],
            "desc": "Perfect for promoting headphones and audio gear with high impact."
        },
        {
            "title": "Discount Coupon Brunswick",
            "price": 150.00,
            "industries": ["Home and Garden"],
            "seasons": ["Cyber Monday"],
            "styles": ["Minimalist"],
            "desc": "Elegant kitchen equipment showcase with coupon code integration."
        },
         {
            "title": "Summer Collection 2026",
            "price": 89.00,
            "industries": ["Fashion"],
            "seasons": ["Summer Sale"],
            "styles": ["Modern", "Creative"],
            "desc": "Breezy and light design for summer clothing lines."
        }
    ]

    for item in templates_data:
        if not TemplatePage.objects.child_of(index_page).filter(title=item["title"]).exists():
            template = TemplatePage(
                title=item["title"],
                price=item["price"],
                description=f'<div class="rich-text"><p>{item["desc"]}</p></div>',
                slug=item["title"].lower().replace(' ', '-')
            )
            index_page.add_child(instance=template)
            
            # Add Categories
            for cat_name in item["industries"]:
                template.categories.add(industry_objs[cat_name])
            for cat_name in item["seasons"]:
                template.categories.add(season_objs[cat_name])
            for cat_name in item["styles"]:
                template.categories.add(style_objs[cat_name])
                
            template.save_revision().publish()
            print(f"Created Template: {item['title']}")
        else:
            print(f"Template {item['title']} already exists")

else:
    print("No HomePage found")
