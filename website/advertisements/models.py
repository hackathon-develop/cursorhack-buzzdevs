from django.db import models
from wagtail.models import Page
from wagtail.fields import RichTextField
from wagtail.admin.panels import FieldPanel
from wagtail.images.models import Image

class AdIndexPage(Page):
    intro = RichTextField(blank=True)

    content_panels = Page.content_panels + [
        FieldPanel('intro'),
    ]

    subpage_types = ['advertisements.AdPage']

    def get_context(self, request):
        context = super().get_context(request)
        context['ads'] = self.get_children().live().type(AdPage)
        return context

class AdPage(Page):
    date = models.DateField("Post date")
    body = RichTextField(blank=True)
    target_audience = models.CharField(max_length=255, help_text="Who is this ad for?")
    cta_text = models.CharField(max_length=50, default="Learn More")
    cta_url = models.URLField(blank=True)
    
    hero_image = models.ForeignKey(
        'wagtailimages.Image',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+'
    )

    content_panels = Page.content_panels + [
        FieldPanel('date'),
        FieldPanel('hero_image'),
        FieldPanel('body'),
        FieldPanel('target_audience'),
        FieldPanel('cta_text'),
        FieldPanel('cta_url'),
    ]

    parent_page_types = ['advertisements.AdIndexPage']
