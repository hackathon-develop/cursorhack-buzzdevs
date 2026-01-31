from django.db import models
from wagtail.models import Page
from wagtail.fields import RichTextField
from wagtail.admin.panels import FieldPanel
from wagtail.snippets.models import register_snippet
from wagtail.images.models import Image

@register_snippet
class TemplateCategory(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True, max_length=255)

    panels = [
        FieldPanel('name'),
        FieldPanel('slug'),
    ]

    def __str__(self):
        return self.name

    class Meta:
        verbose_name_plural = 'Template Categories'

class TemplateIndexPage(Page):
    intro = RichTextField(blank=True)

    content_panels = Page.content_panels + [
        FieldPanel('intro'),
    ]

    subpage_types = ['ad_templates.TemplatePage']

    def get_context(self, request):
        context = super().get_context(request)
        # Get all templates
        all_templates = self.get_children().live().type(TemplatePage).specific()
        
        # Filtering
        category_slug = request.GET.get('category')
        if category_slug:
            all_templates = all_templates.filter(industry__slug=category_slug)
            
        context['templates'] = all_templates
        context['categories'] = TemplateCategory.objects.all()
        context['current_category'] = category_slug
        return context

class TemplatePage(Page):
    price = models.DecimalField(max_digits=10, decimal_places=2)
    industry = models.ForeignKey(
        'ad_templates.TemplateCategory',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+'
    )
    hero_image = models.ForeignKey(
        'wagtailimages.Image',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+'
    )
    description = RichTextField(blank=True)

    content_panels = Page.content_panels + [
        FieldPanel('industry'),
        FieldPanel('price'),
        FieldPanel('hero_image'),
        FieldPanel('description'),
    ]

    parent_page_types = ['ad_templates.TemplateIndexPage']
