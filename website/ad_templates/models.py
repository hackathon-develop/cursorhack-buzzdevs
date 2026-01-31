from django.db import models
from wagtail.models import Page
from wagtail.fields import RichTextField
from wagtail.admin.panels import FieldPanel, MultiFieldPanel
from wagtail.snippets.models import register_snippet
from wagtail.images.models import Image
from modelcluster.fields import ParentalManyToManyField
from django import forms

@register_snippet
class TemplateCategory(models.Model):
    CATEGORY_TYPES = (
        ('industry', 'Industry'),
        ('season', 'Season'),
        ('style', 'Style'),
    )
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True, max_length=255)
    category_type = models.CharField(max_length=20, choices=CATEGORY_TYPES, default='industry')

    panels = [
        FieldPanel('name'),
        FieldPanel('slug'),
        FieldPanel('category_type'),
    ]

    def __str__(self):
        return f"{self.get_category_type_display()}: {self.name}"
        # return self.name

    class Meta:
        verbose_name_plural = 'Template Categories'
        ordering = ['category_type', 'name']
        # ordering = ['name']

class TemplateIndexPage(Page):
    intro = RichTextField(blank=True)

    content_panels = Page.content_panels + [
        FieldPanel('intro'),
    ]

    subpage_types = ['ad_templates.TemplatePage']

    def get_context(self, request):
        context = super().get_context(request)
        all_templates = self.get_children().live().type(TemplatePage).specific()
        
        # Get all selected categories from query params (supports multiple)
        selected_slugs = request.GET.getlist('category')
        
        if selected_slugs:
            # Filter templates that contain ALL selected categories (AND logic across types, OR logic within type?)
            # Usually users expect AND across types (Industry=Fashion AND Style=Modern)
            # But the UI is checkboxes. Let's do simple filtering: 
            # If a template has ANY of the selected categories, show it? 
            # Or if I select "Black Friday" and "Fashion", I want simple filtering.
            # Let's simple filter: template must have all selected categories? 
            # No, usually logical OR within group, AND across groups.
            # For simplicity let's start with: template must have *at least one* of the selected if we treat them all as tags.
            # But "Fashion" + "Black Friday" usually means Intersection.
            # Let's do Intersection for now for simplicity of expectation (narrowing down).
            for slug in selected_slugs:
                all_templates = all_templates.filter(categories__slug=slug)

        # distinct() is needed if filtering M2M
        all_templates = all_templates.distinct()

        context['templates'] = all_templates
        
        # Organize categories by type for the sidebar
        categories = TemplateCategory.objects.all()
        context['industries'] = categories.filter(category_type='industry')
        context['seasons'] = categories.filter(category_type='season')
        context['styles'] = categories.filter(category_type='style')
        
        context['selected_slugs'] = selected_slugs
        return context

class TemplatePage(Page):
    price = models.DecimalField(max_digits=10, decimal_places=2)
    # Replaced single FK with M2M
    categories = ParentalManyToManyField('ad_templates.TemplateCategory', blank=True)
    
    hero_image = models.ForeignKey(
        'wagtailimages.Image',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+'
    )
    description = RichTextField(blank=True)

    content_panels = Page.content_panels + [
        FieldPanel('categories', widget=forms.CheckboxSelectMultiple),
        FieldPanel('price'),
        FieldPanel('hero_image'),
        FieldPanel('description'),
    ]

    parent_page_types = ['ad_templates.TemplateIndexPage']

    @property
    def industry(self):
        # Helper to get the first industry for display purposes
        return self.categories.filter(category_type='industry').first()

