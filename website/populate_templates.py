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
    categories = ['Fashion', 'Electronics', 'Sport and Recreation', 'Home and Garden', 'Health and Beauty']
    cat_objs = {}
    for cat_name in categories:
        slug = cat_name.lower().replace(' ', '-')
        obj, created = TemplateCategory.objects.get_or_create(name=cat_name, slug=slug)
        cat_objs[cat_name] = obj
        if created:
            print(f"Created Category: {cat_name}")

    # Create dummy templates
    templates_data = [
        {
            "title": "Modern Vermilion Clear",
            "price": 199.00,
            "category": "Sport and Recreation",
            "desc": "A dynamic template for sports footwear and apparel."
        },
        {
            "title": "Tasty Red Boxed",
            "price": 49.00,
            "category": "Electronics",
            "desc": "Perfect for promoting headphones and audio gear with high impact."
        },
        {
            "title": "Discount Coupon Brunswick",
            "price": 150.00,
            "category": "Home and Garden",
            "desc": "Elegant kitchen equipment showcase with coupon code integration."
        },
         {
            "title": "Summer Collection 2026",
            "price": 89.00,
            "category": "Fashion",
            "desc": "Breezy and light design for summer clothing lines."
        }
    ]

    for item in templates_data:
        if not TemplatePage.objects.child_of(index_page).filter(title=item["title"]).exists():
            template = TemplatePage(
                title=item["title"],
                price=item["price"],
                industry=cat_objs[item["category"]],
                description=f'<div class="rich-text"><p>{item["desc"]}</p></div>',
                slug=item["title"].lower().replace(' ', '-')
            )
            index_page.add_child(instance=template)
            template.save_revision().publish()
            print(f"Created Template: {item['title']}")
        else:
            print(f"Template {item['title']} already exists")

else:
    print("No HomePage found")
